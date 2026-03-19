import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('students')
    .select(`
      *,
      parent_emails(id, email, label),
      student_subjects(id, subject_id, subject:subjects(id, name)),
      teacher_student_assignments(id, teacher_id, subject_id, teacher:profiles(id, display_name))
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // 今後の契約情報も返す（退塾モーダル用）
  const includeContracts = request.nextUrl.searchParams.get('include_contracts')
  if (includeContracts) {
    const today = new Date().toISOString().slice(0, 10)
    const admin = createAdminClient()
    const { data: contracts } = await admin
      .from('contracts')
      .select('id, grade, courses, start_date, end_date, monthly_amount')
      .eq('student_id', id)
      .gte('end_date', today)
      .order('start_date')
    return NextResponse.json({ data, contracts: contracts || [] })
  }

  return NextResponse.json({ data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const {
    name, grade, send_mode, weekly_lesson_count, status, student_number,
    direct_debit_start_ym,
    parent_emails, subject_ids, teacher_assignments
  } = body

  const admin = createAdminClient()

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (grade !== undefined) updateData.grade = grade || null
  if (send_mode !== undefined) updateData.send_mode = send_mode || 'manual'
  if (weekly_lesson_count !== undefined) updateData.weekly_lesson_count = weekly_lesson_count || null
  if (status !== undefined) updateData.status = status
  if (student_number !== undefined) updateData.student_number = student_number || null
  if (direct_debit_start_ym !== undefined) updateData.direct_debit_start_ym = direct_debit_start_ym || null

  const { data: student, error } = await admin
    .from('students')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 退塾処理: テンプレート無効化 + 未来の授業キャンセル + 契約削除（オプション）
  let templatesDeactivated = 0
  let lessonsCancelled = 0
  let contractsDeleted = 0
  if (status === 'withdrawn') {
    const today = new Date().toISOString().slice(0, 10)

    // テンプレートを無効化
    const { data: deactivated } = await admin
      .from('regular_lesson_templates')
      .update({ is_active: false })
      .eq('student_id', id)
      .eq('is_active', true)
      .select('id')
    templatesDeactivated = deactivated?.length || 0

    // 未来の scheduled 授業をキャンセル
    const { data: cancelled } = await admin
      .from('lessons')
      .update({ status: 'cancelled' })
      .eq('student_id', id)
      .eq('status', 'scheduled')
      .gte('lesson_date', today)
      .select('id')
    lessonsCancelled = cancelled?.length || 0

    // 契約・請求の削除（オプション）
    if (body.delete_contracts) {
      const { data: contracts } = await admin
        .from('contracts')
        .select('id')
        .eq('student_id', id)
        .gte('end_date', today)
      const contractIds = (contracts || []).map(c => c.id)
      if (contractIds.length > 0) {
        await admin.from('billing_confirmations').delete().in('contract_id', contractIds)
        await admin.from('payments').delete().in('contract_id', contractIds)
        await admin.from('adjustments').delete().in('contract_id', contractIds)
        await admin.from('contracts').delete().in('id', contractIds)
        contractsDeleted = contractIds.length
      }
    }
  }

  // Replace parent emails
  if (parent_emails !== undefined) {
    await admin.from('parent_emails').delete().eq('student_id', id)
    if (parent_emails?.length) {
      await admin.from('parent_emails').insert(
        parent_emails.map((pe: { email: string; label?: string }) => ({
          student_id: id,
          email: pe.email,
          label: pe.label || null,
        }))
      )
    }
  }

  // Replace student subjects
  if (subject_ids !== undefined) {
    await admin.from('student_subjects').delete().eq('student_id', id)
    if (subject_ids?.length) {
      await admin.from('student_subjects').insert(
        subject_ids.map((sid: string) => ({ student_id: id, subject_id: sid }))
      )
    }
  }

  // Replace teacher assignments
  if (teacher_assignments !== undefined) {
    await admin.from('teacher_student_assignments').delete().eq('student_id', id)
    if (teacher_assignments?.length) {
      await admin.from('teacher_student_assignments').insert(
        teacher_assignments.map((ta: { teacher_id: string; subject_id?: string }) => ({
          teacher_id: ta.teacher_id,
          student_id: id,
          subject_id: ta.subject_id || null,
        }))
      )
    }
  }

  return NextResponse.json({ data: student, templatesDeactivated, lessonsCancelled, contractsDeleted })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // 関連する契約・講習・教材販売・手動請求・入金・調整を先に削除
  const { data: studentContracts } = await admin.from('contracts').select('id').eq('student_id', id)
  const contractIds = (studentContracts || []).map(c => c.id)
  if (contractIds.length > 0) {
    await admin.from('billing_confirmations').delete().in('contract_id', contractIds)
    await admin.from('payments').delete().in('contract_id', contractIds)
    await admin.from('adjustments').delete().in('contract_id', contractIds)
    await admin.from('contracts').delete().in('id', contractIds)
  }
  await admin.from('billing_confirmations').delete().eq('student_id', id)
  await admin.from('lectures').delete().eq('student_id', id)
  await admin.from('material_sales').delete().eq('student_id', id)
  await admin.from('manual_billings').delete().eq('student_id', id)

  // 論理削除（status を 'deleted' に変更）
  const { error } = await admin.from('students').update({ status: 'deleted' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

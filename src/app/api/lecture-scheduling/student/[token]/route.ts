import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 生徒個別URL: トークンで情報を取得
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  // トークンから生徒・期間情報を取得
  const { data: invitation } = await admin
    .from('lecture_scheduling_student_tokens')
    .select('id, period_id, student_id, student:students(id, name, student_number, grade)')
    .eq('token', token)
    .single()

  if (!invitation) {
    return NextResponse.json({ error: '無効なURLです' }, { status: 404 })
  }

  const { data: period } = await admin
    .from('lecture_scheduling_periods')
    .select('id, label, start_date, end_date, student_deadline, status')
    .eq('id', invitation.period_id)
    .single()

  if (!period) return NextResponse.json({ error: '期間が見つかりません' }, { status: 404 })
  if (period.status !== 'open') {
    return NextResponse.json({ error: 'この講習の受付は終了しました' }, { status: 410 })
  }
  if (period.student_deadline && new Date(period.student_deadline) < new Date()) {
    return NextResponse.json({ error: '回答期限を過ぎています' }, { status: 410 })
  }

  const student = invitation.student as unknown as { id: string; name: string; student_number: string; grade: string }

  // time_slots
  const { data: timeSlots } = await admin
    .from('time_slots')
    .select('id, slot_number, label, start_time, end_time')
    .order('sort_order')

  // 休館日
  const { data: closedDays } = await admin
    .from('closed_days')
    .select('closed_date')
    .gte('closed_date', period.start_date)
    .lte('closed_date', period.end_date)

  // comiru授業データ（この生徒の期間内の授業）
  const { data: comiruLessons } = await admin
    .from('comiru_lessons')
    .select('lesson_date, start_time, teacher_name')
    .eq('student_name', student.name)
    .gte('lesson_date', period.start_date)
    .lte('lesson_date', period.end_date)

  // 既存回答があれば復元用に取得
  const { data: existingRequest } = await admin
    .from('lecture_scheduling_requests')
    .select('id, subjects, note')
    .eq('period_id', period.id)
    .eq('student_id', student.id)
    .single()

  let existingNgSlots: { ng_date: string; time_slot_id: string | null }[] = []
  if (existingRequest) {
    const { data: ngs } = await admin
      .from('lecture_scheduling_ng_slots')
      .select('ng_date, time_slot_id')
      .eq('request_id', existingRequest.id)
    existingNgSlots = ngs || []
  }

  return NextResponse.json({
    student,
    period,
    timeSlots: timeSlots || [],
    closedDates: (closedDays || []).map(d => d.closed_date),
    comiruLessons: (comiruLessons || []).map(l => ({
      lesson_date: l.lesson_date,
      start_time: l.start_time,
      teacher_name: l.teacher_name,
    })),
    existingRequest: existingRequest ? {
      subjects: existingRequest.subjects,
      note: existingRequest.note,
    } : null,
    existingNgSlots,
  })
}

// 生徒個別URL: 希望を提出
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: invitation } = await admin
    .from('lecture_scheduling_student_tokens')
    .select('id, period_id, student_id')
    .eq('token', token)
    .single()

  if (!invitation) return NextResponse.json({ error: '無効なURLです' }, { status: 404 })

  const { data: period } = await admin
    .from('lecture_scheduling_periods')
    .select('id, status, student_deadline')
    .eq('id', invitation.period_id)
    .single()

  if (!period) return NextResponse.json({ error: '期間エラー' }, { status: 404 })
  if (period.status !== 'open') return NextResponse.json({ error: '受付終了' }, { status: 410 })
  if (period.student_deadline && new Date(period.student_deadline) < new Date()) {
    return NextResponse.json({ error: '回答期限を過ぎています' }, { status: 410 })
  }

  const body = await request.json()
  const { subjects, ng_slots, note } = body

  if (!subjects) {
    return NextResponse.json({ error: '科目を入力してください' }, { status: 400 })
  }

  // upsert
  const { data: req, error: reqError } = await admin
    .from('lecture_scheduling_requests')
    .upsert(
      {
        period_id: period.id,
        student_id: invitation.student_id,
        subjects,
        note: note || null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'period_id,student_id' }
    )
    .select()
    .single()

  if (reqError) return NextResponse.json({ error: reqError.message }, { status: 500 })

  // NG slots
  await admin.from('lecture_scheduling_ng_slots').delete().eq('request_id', req.id)

  if (ng_slots && ng_slots.length > 0) {
    const rows = ng_slots.map((s: { ng_date: string; time_slot_id: string | null }) => ({
      request_id: req.id,
      ng_date: s.ng_date,
      time_slot_id: s.time_slot_id,
    }))
    const { error: ngError } = await admin.from('lecture_scheduling_ng_slots').insert(rows)
    if (ngError) return NextResponse.json({ error: ngError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

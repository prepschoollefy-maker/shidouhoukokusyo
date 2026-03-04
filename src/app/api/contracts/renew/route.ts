import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcMonthlyAmount, CourseEntry } from '@/lib/contracts/pricing'
import { verifyContractPassword } from '@/lib/contracts/auth'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const body = await request.json()
  const { contract_id, new_grade, new_courses, new_start_date, new_end_date } = body

  if (!contract_id || !new_grade || !new_courses?.length || !new_start_date || !new_end_date) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 前契約を取得
  const { data: prev, error: prevError } = await admin
    .from('contracts')
    .select('*')
    .eq('id', contract_id)
    .single()

  if (prevError || !prev) {
    return NextResponse.json({ error: '前契約が見つかりません' }, { status: 404 })
  }

  // 月謝計算
  const monthly_amount = calcMonthlyAmount(new_grade, new_courses as CourseEntry[])

  // 新契約INSERT
  const { data: newContract, error: insertError } = await admin
    .from('contracts')
    .insert({
      student_id: prev.student_id,
      type: 'renewal',
      start_date: new_start_date,
      end_date: new_end_date,
      grade: new_grade,
      courses: new_courses,
      monthly_amount,
      notes: '一括更新',
      prev_contract_id: contract_id,
      enrollment_fee: 0,
      campaign: null,
      campaign_discount: 0,
    })
    .select('id, monthly_amount')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    contract_id: newContract.id,
    monthly_amount: newContract.monthly_amount,
  })
}

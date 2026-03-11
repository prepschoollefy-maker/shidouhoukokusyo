import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 生徒用: トークンで期間情報を取得（生徒一覧は返さない）
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: period, error } = await admin
    .from('lecture_scheduling_periods')
    .select('id, label, start_date, end_date, student_deadline, status')
    .eq('student_token', token)
    .single()

  if (error || !period) {
    return NextResponse.json({ error: '無効なURLです' }, { status: 404 })
  }
  if (period.status !== 'open') {
    return NextResponse.json({ error: 'この講習の受付は終了しました' }, { status: 410 })
  }
  if (period.student_deadline && new Date(period.student_deadline) < new Date()) {
    return NextResponse.json({ error: '回答期限を過ぎています' }, { status: 410 })
  }

  // time_slots
  const { data: timeSlots } = await admin
    .from('time_slots')
    .select('id, slot_number, label, start_time, end_time')
    .order('sort_order')

  // 休館日（期間内のみ）
  const { data: closedDays } = await admin
    .from('closed_days')
    .select('closed_date')
    .gte('closed_date', period.start_date)
    .lte('closed_date', period.end_date)

  return NextResponse.json({
    period,
    timeSlots: timeSlots || [],
    closedDates: (closedDays || []).map(d => d.closed_date),
  })
}

// 生徒用: 希望を提出（塾生番号＋氏名で照合）
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  // 期間バリデーション
  const { data: period } = await admin
    .from('lecture_scheduling_periods')
    .select('id, status, student_deadline')
    .eq('student_token', token)
    .single()

  if (!period) return NextResponse.json({ error: '無効なURLです' }, { status: 404 })
  if (period.status !== 'open') return NextResponse.json({ error: '受付終了' }, { status: 410 })
  if (period.student_deadline && new Date(period.student_deadline) < new Date()) {
    return NextResponse.json({ error: '回答期限を過ぎています' }, { status: 410 })
  }

  const body = await request.json()
  const { student_number, student_name, subjects, ng_slots, note } = body

  if (!student_number || !student_name || !subjects) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  // 塾生番号＋氏名で照合
  const { data: student } = await admin
    .from('students')
    .select('id, name, student_number')
    .eq('student_number', student_number)
    .neq('status', 'deleted')
    .single()

  if (!student) {
    return NextResponse.json({ error: '塾生番号が見つかりません。正しい番号を入力してください。' }, { status: 400 })
  }
  if (student.name !== student_name.trim()) {
    return NextResponse.json({ error: '氏名が一致しません。正しい氏名を入力してください。' }, { status: 400 })
  }

  // upsert: 同じ生徒の再回答を許可
  const { data: req, error: reqError } = await admin
    .from('lecture_scheduling_requests')
    .upsert(
      { period_id: period.id, student_id: student.id, subjects, note: note || null, submitted_at: new Date().toISOString() },
      { onConflict: 'period_id,student_id' }
    )
    .select()
    .single()

  if (reqError) return NextResponse.json({ error: reqError.message }, { status: 500 })

  // NG slots: 既存削除して再登録
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

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 講師用: トークンでアサイン情報を取得
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: assignment, error } = await admin
    .from('lecture_scheduling_assignments')
    .select(`
      id, status, expires_at,
      teacher:profiles(id, display_name),
      request:lecture_scheduling_requests(
        id, subjects, note,
        student:students(id, name, grade),
        period:lecture_scheduling_periods(id, label, start_date, end_date)
      )
    `)
    .eq('token', token)
    .single()

  if (error || !assignment) {
    return NextResponse.json({ error: '無効なURLです' }, { status: 404 })
  }

  if (new Date(assignment.expires_at) < new Date()) {
    return NextResponse.json({ error: 'このリンクの有効期限が切れています' }, { status: 410 })
  }

  const req = assignment.request as unknown as {
    id: string
    subjects: Record<string, number>
    note: string | null
    student: { id: string; name: string; grade: string }
    period: { id: string; label: string; start_date: string; end_date: string }
  }

  // NG slots
  const { data: ngSlots } = await admin
    .from('lecture_scheduling_ng_slots')
    .select('ng_date, time_slot_id')
    .eq('request_id', req.id)

  // time_slots
  const { data: timeSlots } = await admin
    .from('time_slots')
    .select('id, slot_number, label, start_time, end_time')
    .order('sort_order')

  // 休館日（期間内のみ）
  const { data: closedDays } = await admin
    .from('closed_days')
    .select('closed_date')
    .gte('closed_date', req.period.start_date)
    .lte('closed_date', req.period.end_date)

  // 既存回答
  const { data: existingResponses } = await admin
    .from('lecture_scheduling_responses')
    .select('available_date, time_slot_id')
    .eq('assignment_id', assignment.id)

  // 同じ講師の同じ期間内の他の生徒への回答（プリセット用）
  const teacherId = (assignment.teacher as unknown as { id: string }).id
  const { data: otherAssignments } = await admin
    .from('lecture_scheduling_assignments')
    .select('id, request:lecture_scheduling_requests(period_id)')
    .eq('teacher_id', teacherId)
    .eq('status', 'responded')
    .neq('id', assignment.id)

  const sameperiodAssignmentIds = (otherAssignments || [])
    .filter((a: { request: unknown }) => {
      const r = a.request as { period_id: string } | null
      return r && r.period_id === req.period.id
    })
    .map((a: { id: string }) => a.id)

  let otherTeacherResponses: { available_date: string; time_slot_id: string }[] = []
  if (sameperiodAssignmentIds.length > 0) {
    const { data: otherResp } = await admin
      .from('lecture_scheduling_responses')
      .select('available_date, time_slot_id')
      .in('assignment_id', sameperiodAssignmentIds)
    // 重複排除
    const seen = new Set<string>()
    otherTeacherResponses = (otherResp || []).filter(r => {
      const key = `${r.available_date}|${r.time_slot_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  // comiru授業データ（この講師の期間内の授業）
  const teacherName = (assignment.teacher as unknown as { display_name: string }).display_name
  const { data: comiruLessons } = await admin
    .from('comiru_lessons')
    .select('lesson_date, start_time, student_name')
    .eq('teacher_name', teacherName)
    .gte('lesson_date', req.period.start_date)
    .lte('lesson_date', req.period.end_date)

  return NextResponse.json({
    assignment: {
      id: assignment.id,
      status: assignment.status,
      expires_at: assignment.expires_at,
    },
    teacher: assignment.teacher,
    student: req.student,
    period: req.period,
    subjects: req.subjects,
    studentNote: req.note,
    ngSlots: ngSlots || [],
    timeSlots: timeSlots || [],
    closedDates: (closedDays || []).map(d => d.closed_date),
    existingResponses: existingResponses || [],
    comiruLessons: (comiruLessons || []).map(l => ({
      lesson_date: l.lesson_date,
      start_time: l.start_time,
      student_name: l.student_name,
    })),
    otherTeacherResponses,
  })
}

// 講師用: 担当可能コマを送信
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: assignment } = await admin
    .from('lecture_scheduling_assignments')
    .select('id, expires_at')
    .eq('token', token)
    .single()

  if (!assignment) return NextResponse.json({ error: '無効なURLです' }, { status: 404 })
  if (new Date(assignment.expires_at) < new Date()) {
    return NextResponse.json({ error: '有効期限切れです' }, { status: 410 })
  }

  const body = await request.json()
  const { available_slots } = body as { available_slots: { available_date: string; time_slot_id: string }[] }

  if (!available_slots || !Array.isArray(available_slots)) {
    return NextResponse.json({ error: '回答データが不正です' }, { status: 400 })
  }

  // 既存回答を削除して再登録（再回答対応）
  await admin.from('lecture_scheduling_responses').delete().eq('assignment_id', assignment.id)

  if (available_slots.length > 0) {
    const rows = available_slots.map(s => ({
      assignment_id: assignment.id,
      available_date: s.available_date,
      time_slot_id: s.time_slot_id,
    }))
    const { error } = await admin.from('lecture_scheduling_responses').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ステータスを更新
  await admin
    .from('lecture_scheduling_assignments')
    .update({ status: 'responded' })
    .eq('id', assignment.id)

  return NextResponse.json({ ok: true })
}

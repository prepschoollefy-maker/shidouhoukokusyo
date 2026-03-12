import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 期間ごとの全体一覧（生徒回答 + 講師アサイン + 講師回答）
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const periodId = request.nextUrl.searchParams.get('period_id')
  if (!periodId) return NextResponse.json({ error: 'period_id required' }, { status: 400 })

  const admin = createAdminClient()

  // 期間情報
  const { data: period } = await admin
    .from('lecture_scheduling_periods')
    .select('*')
    .eq('id', periodId)
    .single()

  if (!period) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 全リクエスト（生徒回答）
  const { data: requests } = await admin
    .from('lecture_scheduling_requests')
    .select('*, student:students(id, name, student_number, grade)')
    .eq('period_id', periodId)
    .order('submitted_at')

  // 全NGスロット
  const requestIds = (requests || []).map(r => r.id)
  let ngSlots: { request_id: string; ng_date: string; time_slot_id: string | null }[] = []
  if (requestIds.length > 0) {
    const { data } = await admin
      .from('lecture_scheduling_ng_slots')
      .select('request_id, ng_date, time_slot_id')
      .in('request_id', requestIds)
    ngSlots = data || []
  }

  // 全アサイン
  let assignments: Record<string, unknown>[] = []
  if (requestIds.length > 0) {
    const { data } = await admin
      .from('lecture_scheduling_assignments')
      .select('*, teacher:profiles(id, display_name)')
      .in('request_id', requestIds)
    assignments = data || []
  }

  // 全講師回答
  const assignmentIds = assignments.map(a => (a as { id: string }).id)
  let responses: { assignment_id: string; available_date: string; time_slot_id: string }[] = []
  if (assignmentIds.length > 0) {
    const { data } = await admin
      .from('lecture_scheduling_responses')
      .select('assignment_id, available_date, time_slot_id')
      .in('assignment_id', assignmentIds)
    responses = data || []
  }

  // time_slots
  const { data: timeSlots } = await admin
    .from('time_slots')
    .select('id, slot_number, label, start_time, end_time')
    .order('sort_order')

  // 講師一覧
  const { data: teachers } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('role', 'teacher')
    .order('display_name')

  // 休館日（期間内のみ）
  const { data: closedDays } = await admin
    .from('closed_days')
    .select('closed_date')
    .gte('closed_date', period.start_date)
    .lte('closed_date', period.end_date)

  // comiruレッスンデータ（期間内のみ）
  const { data: comiruLessons } = await admin
    .from('comiru_lessons')
    .select('teacher_name, lesson_date, start_time, end_time, synced_at, student_name')
    .gte('lesson_date', period.start_date)
    .lte('lesson_date', period.end_date)

  // 確定データ
  let confirmations: { id: string; request_id: string; assignment_id: string; confirmed_date: string; time_slot_id: string; subject: string; confirmed_at: string }[] = []
  if (requestIds.length > 0) {
    const { data } = await admin
      .from('lecture_scheduling_confirmations')
      .select('id, request_id, assignment_id, confirmed_date, time_slot_id, subject, confirmed_at')
      .in('request_id', requestIds)
    confirmations = data || []
  }

  return NextResponse.json({
    period,
    requests: requests || [],
    ngSlots,
    assignments,
    responses,
    timeSlots: timeSlots || [],
    teachers: teachers || [],
    closedDates: (closedDays || []).map((d: { closed_date: string }) => d.closed_date),
    comiruLessons: comiruLessons || [],
    confirmations,
  })
}

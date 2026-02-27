import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Unchecked summaries count
  const { count: uncheckedCount } = await admin
    .from('summaries')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'unchecked')

  // Teacher report counts (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: recentReports } = await admin
    .from('lesson_reports')
    .select('teacher_id, teacher:profiles(display_name)')
    .gte('created_at', sevenDaysAgo.toISOString())

  const teacherCounts: Record<string, { name: string; count: number }> = {}
  recentReports?.forEach(r => {
    const tid = r.teacher_id
    if (!teacherCounts[tid]) {
      teacherCounts[tid] = {
        name: (r.teacher as unknown as { display_name: string }).display_name,
        count: 0,
      }
    }
    teacherCounts[tid].count++
  })

  // Missing report alerts (active students only)
  const { data: students } = await admin
    .from('students')
    .select('id, name, weekly_lesson_count')
    .eq('status', 'active')
    .not('weekly_lesson_count', 'is', null)

  const { data: weekReports } = await admin
    .from('lesson_reports')
    .select('student_id')
    .gte('lesson_date', sevenDaysAgo.toISOString().split('T')[0])

  const reportCountByStudent: Record<string, number> = {}
  weekReports?.forEach(r => {
    reportCountByStudent[r.student_id] = (reportCountByStudent[r.student_id] || 0) + 1
  })

  const alerts = students
    ?.filter(s => {
      const expected = s.weekly_lesson_count || 0
      const actual = reportCountByStudent[s.id] || 0
      return actual < expected
    })
    .map(s => ({
      student_id: s.id,
      student_name: s.name,
      expected: s.weekly_lesson_count,
      actual: reportCountByStudent[s.id] || 0,
    })) || []

  return NextResponse.json({
    data: {
      unchecked_summaries: uncheckedCount || 0,
      teacher_report_counts: Object.values(teacherCounts),
      missing_report_alerts: alerts,
    },
  })
}

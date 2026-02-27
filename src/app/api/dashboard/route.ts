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

  return NextResponse.json({
    data: {
      unchecked_summaries: uncheckedCount || 0,
      teacher_report_counts: Object.values(teacherCounts),
    },
  })
}

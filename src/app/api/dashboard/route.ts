import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FACILITY_FEE_MONTHLY_TAX_INCL } from '@/lib/contracts/pricing'

const GRADE_ORDER = ['小3','小4','小5','小6','中1','中2','中3','高1','高2','高3','浪人']

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

  // --- 学年別統計 ---
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const firstDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
  const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

  // 在籍生徒数（学年別）
  const { data: activeStudents } = await admin
    .from('students')
    .select('grade')
    .eq('status', 'active')

  const gradeStudentCounts: Record<string, number> = {}
  activeStudents?.forEach(s => {
    const g = s.grade || '未設定'
    gradeStudentCounts[g] = (gradeStudentCounts[g] || 0) + 1
  })

  // 当月有効な契約（月謝・コマ数）
  const { data: activeContracts } = await admin
    .from('contracts')
    .select('grade, monthly_amount, courses')
    .lte('start_date', lastDay)
    .gte('end_date', firstDay)

  const gradeRevenue: Record<string, number> = {}
  const gradeLessons: Record<string, number> = {}
  activeContracts?.forEach(c => {
    const g = c.grade || '未設定'
    // 月謝 + 設備利用料
    gradeRevenue[g] = (gradeRevenue[g] || 0) + (c.monthly_amount || 0) + FACILITY_FEE_MONTHLY_TAX_INCL
    const courses = (c.courses || []) as { lessons: number }[]
    const totalLessons = courses.reduce((sum, course) => sum + (course.lessons || 0), 0)
    gradeLessons[g] = (gradeLessons[g] || 0) + totalLessons
  })

  // 全学年を統合してソート
  const allGrades = new Set([
    ...Object.keys(gradeStudentCounts),
    ...Object.keys(gradeRevenue),
    ...Object.keys(gradeLessons),
  ])
  const gradeStats = [...allGrades]
    .sort((a, b) => {
      const ai = GRADE_ORDER.indexOf(a)
      const bi = GRADE_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return 1
      return ai - bi
    })
    .map(grade => ({
      grade,
      student_count: gradeStudentCounts[grade] || 0,
      monthly_revenue: gradeRevenue[grade] || 0,
      weekly_lessons: gradeLessons[grade] || 0,
    }))

  const totalStudents = activeStudents?.length || 0
  const totalRevenue = gradeStats.reduce((s, g) => s + g.monthly_revenue, 0)
  const totalLessons = gradeStats.reduce((s, g) => s + g.weekly_lessons, 0)

  return NextResponse.json({
    data: {
      unchecked_summaries: uncheckedCount || 0,
      teacher_report_counts: Object.values(teacherCounts),
      grade_stats: gradeStats,
      total_students: totalStudents,
      total_revenue: totalRevenue,
      total_weekly_lessons: totalLessons,
      billing_month: `${currentYear}年${currentMonth}月`,
    },
  })
}

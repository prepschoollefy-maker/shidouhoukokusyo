import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyContractPassword } from '@/lib/contracts/auth'
import { FACILITY_FEE_MONTHLY_TAX_INCL, FACILITY_FEE_HALF_TAX_INCL } from '@/lib/contracts/pricing'

const GRADE_ORDER = ['小3','小4','小5','小6','中1','中2','中3','高1','高2','高3','浪人']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const now = new Date()
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(now.getFullYear()))
  const month = parseInt(request.nextUrl.searchParams.get('month') || String(now.getMonth() + 1))

  // 12ヶ月分の範囲を計算（当月含む過去12ヶ月）
  const endYear = year
  const endMonth = month
  const startYear = month <= 11 ? year - 1 : year
  const startMonth = ((month - 12 + 11) % 12) + 1

  const rangeStart = `${startYear}-${String(startMonth).padStart(2, '0')}-01`
  const rangeEnd = new Date(endYear, endMonth, 0).toISOString().split('T')[0]

  // 1クエリで全期間の契約を取得
  const { data, error } = await supabase
    .from('contracts')
    .select('id, student_id, start_date, end_date, monthly_amount, enrollment_fee, campaign_discount, grade, courses')
    .lte('start_date', rangeEnd)
    .gte('end_date', rangeStart)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contracts = data || []

  // 講習データも取得
  const { data: lectureRows, error: lectureError } = await supabase
    .from('lectures')
    .select('id, student_id, courses')

  if (lectureError) return NextResponse.json({ error: lectureError.message }, { status: 500 })

  const lectures = lectureRows || []

  // 教材販売データも取得（adminClient使用 - RLS対応）
  const admin = createAdminClient()
  const { data: materialRows } = await admin
    .from('material_sales')
    .select('id, student_id, total_amount, billing_year, billing_month')

  const materialSales = materialRows || []

  interface LectureAlloc { year: number; month: number; lessons: number }
  interface LectureCourse { course: string; total_lessons: number; unit_price: number; subtotal: number; allocation: LectureAlloc[] }

  // JS側で月別集計
  const months: { year: number; month: number; revenue: number; count: number }[] = []
  for (let i = 0; i < 12; i++) {
    let m = startMonth + i
    let y = startYear
    if (m > 12) { m -= 12; y += 1 }

    const firstDay = new Date(y, m - 1, 1)
    const lastDay = new Date(y, m, 0)

    let revenue = 0
    const studentIds = new Set<string>()

    for (const c of contracts) {
      const cStart = new Date(c.start_date)
      const cEnd = new Date(c.end_date)
      if (cStart <= lastDay && cEnd >= firstDay) {
        const isFirstMonth = cStart.getFullYear() === y && cStart.getMonth() + 1 === m
        const isHalf = isFirstMonth && cStart.getDate() >= 16

        // 授業料（16日開始の初月は半額）
        let monthRevenue = isHalf ? Math.floor(c.monthly_amount / 2) : c.monthly_amount
        // 設備利用料
        monthRevenue += isHalf ? 1650 : 3300
        // 初月: 入塾金 - キャンペーン割引
        if (isFirstMonth) {
          monthRevenue += (c.enrollment_fee || 0)
          monthRevenue -= (c.campaign_discount || 0)
        }

        revenue += monthRevenue
        studentIds.add(c.student_id)
      }
    }

    // 講習の月別売上を加算
    for (const l of lectures) {
      const courses = (l.courses || []) as LectureCourse[]
      for (const c of courses) {
        for (const a of c.allocation || []) {
          if (a.year === y && a.month === m && a.lessons > 0) {
            revenue += c.unit_price * a.lessons
            studentIds.add(l.student_id)
          }
        }
      }
    }

    // 教材販売の月別売上を加算
    for (const ms of materialSales) {
      if (ms.billing_year === y && ms.billing_month === m) {
        revenue += ms.total_amount
        studentIds.add(ms.student_id)
      }
    }

    months.push({ year: y, month: m, revenue, count: studentIds.size })
  }

  // --- 学年別統計（選択月） ---
  const targetY = endYear
  const targetM = endMonth
  const targetFirstDay = new Date(targetY, targetM - 1, 1)
  const targetLastDay = new Date(targetY, targetM, 0)

  const gradeRevenue: Record<string, number> = {}
  const gradeLessons: Record<string, number> = {}
  const gradeStudentIds: Record<string, Set<string>> = {}

  // 通常コース
  for (const c of contracts) {
    const cStart = new Date(c.start_date)
    const cEnd = new Date(c.end_date)
    if (cStart <= targetLastDay && cEnd >= targetFirstDay) {
      const g = c.grade || '未設定'
      if (!gradeStudentIds[g]) gradeStudentIds[g] = new Set()
      gradeStudentIds[g].add(c.student_id)

      const isFirstMonth = cStart.getFullYear() === targetY && cStart.getMonth() + 1 === targetM
      const isHalf = isFirstMonth && cStart.getDate() >= 16

      let rev = isHalf ? Math.floor(c.monthly_amount / 2) : c.monthly_amount
      rev += isHalf ? FACILITY_FEE_HALF_TAX_INCL : FACILITY_FEE_MONTHLY_TAX_INCL
      if (isFirstMonth) {
        rev += (c.enrollment_fee || 0)
        rev -= (c.campaign_discount || 0)
      }
      gradeRevenue[g] = (gradeRevenue[g] || 0) + rev

      const courses = (c.courses || []) as { lessons: number }[]
      const totalLessons = courses.reduce((sum, course) => sum + (course.lessons || 0), 0)
      gradeLessons[g] = (gradeLessons[g] || 0) + totalLessons
    }
  }

  // 講習
  for (const l of lectures) {
    const lCourses = (l.courses || []) as LectureCourse[]
    for (const c of lCourses) {
      for (const a of c.allocation || []) {
        if (a.year === targetY && a.month === targetM && a.lessons > 0) {
          // 講習は学年情報がないため student_id ベースでは集計しない
        }
      }
    }
  }

  // 全学年をソートして返す
  const allGrades = new Set(Object.keys(gradeRevenue))
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
      student_count: gradeStudentIds[grade]?.size || 0,
      monthly_revenue: gradeRevenue[grade] || 0,
      weekly_lessons: gradeLessons[grade] || 0,
    }))

  const totalGradeStudents = gradeStats.reduce((s, g) => s + g.student_count, 0)
  const totalGradeRevenue = gradeStats.reduce((s, g) => s + g.monthly_revenue, 0)
  const totalGradeLessons = gradeStats.reduce((s, g) => s + g.weekly_lessons, 0)

  return NextResponse.json({
    data: months,
    gradeStats,
    totalGradeStudents,
    totalGradeRevenue,
    totalGradeLessons,
  })
}

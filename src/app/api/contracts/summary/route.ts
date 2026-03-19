import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyContractPassword } from '@/lib/contracts/auth'
import {
  FACILITY_FEE_MONTHLY_TAX_INCL, FACILITY_FEE_HALF_TAX_INCL,
  GRADE_NEXT, calcMonthlyAmount, type CourseEntry,
} from '@/lib/contracts/pricing'

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
    .select('id, student_id, start_date, end_date, monthly_amount, enrollment_fee, campaign_discount, campaign, grade, courses')
    .lte('start_date', rangeEnd)
    .gte('end_date', rangeStart)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contracts = data || []

  // 講習データも取得
  const { data: lectureRows, error: lectureError } = await supabase
    .from('lectures')
    .select('id, student_id, label, grade, courses')

  if (lectureError) return NextResponse.json({ error: lectureError.message }, { status: 500 })

  const lectures = lectureRows || []

  // 教材販売データも取得（adminClient使用 - RLS対応）
  const admin = createAdminClient()
  const { data: materialRows } = await admin
    .from('material_sales')
    .select('id, student_id, item_name, unit_price, quantity, total_amount, billing_year, billing_month')

  const materialSales = materialRows || []


  interface LectureAlloc { year: number; month: number; lessons: number }
  interface LectureCourse { course: string; total_lessons: number; unit_price: number; subtotal: number; allocation: LectureAlloc[] }

  // JS側で月別集計（カテゴリ別内訳付き）
  const months: { year: number; month: number; revenue: number; contractRevenue: number; lectureRevenue: number; materialRevenue: number; count: number }[] = []
  for (let i = 0; i < 12; i++) {
    let m = startMonth + i
    let y = startYear
    if (m > 12) { m -= 12; y += 1 }

    const firstDay = new Date(y, m - 1, 1)
    const lastDay = new Date(y, m, 0)

    let contractRevenue = 0
    let lectureRevenue = 0
    let materialRevenue = 0
    const studentIds = new Set<string>()

    for (const c of contracts) {
      const cStart = new Date(c.start_date)
      const cEnd = new Date(c.end_date)
      if (cStart <= lastDay && cEnd >= firstDay) {
        const cStartMonth = cStart.getMonth() + 1
        const isFirstMonth = cStart.getFullYear() === y && cStartMonth === m
        const cSecondMonth = cStartMonth === 12 ? 1 : cStartMonth + 1
        const cSecondYear = cStartMonth === 12 ? cStart.getFullYear() + 1 : cStart.getFullYear()
        const isSecondMonth = cSecondYear === y && cSecondMonth === m
        const isHalf = isFirstMonth && cStart.getDate() >= 16

        // 授業料（2ヶ月目が4月なら進級後学年で再計算）
        const courses = (c.courses as CourseEntry[]) || []
        let tuition: number
        if (isSecondMonth && cSecondMonth === 4) {
          const ng = GRADE_NEXT[c.grade]
          tuition = ng ? calcMonthlyAmount(ng, courses) : c.monthly_amount
        } else if (isHalf) {
          tuition = Math.floor(c.monthly_amount / 2)
        } else {
          tuition = c.monthly_amount
        }
        const facilityFee = isHalf ? 1650 : 3300
        // キャンペーン割引（契約書モデル準拠: 初月に2コマ分全額適用、マイナス繰越）
        const campaign = (c as Record<string, unknown>).campaign as string || ''
        const storedDiscount = c.campaign_discount || 0
        let campaignDiscount = 0
        if (campaign === '講習キャンペーン' && storedDiscount > 0) {
          if (isFirstMonth) {
            campaignDiscount = storedDiscount * 2
          } else if (isSecondMonth) {
            const firstIsHalf = cStart.getDate() >= 16
            const firstTuition = firstIsHalf ? Math.floor(c.monthly_amount / 2) : c.monthly_amount
            const firstTuitionAfterDiscount = firstTuition - storedDiscount * 2
            if (firstTuitionAfterDiscount < 0) campaignDiscount = Math.abs(firstTuitionAfterDiscount)
          }
        }
        let monthRevenue = Math.max(0, tuition - campaignDiscount) + facilityFee
        // 入塾金（初月のみ）
        if (isFirstMonth) {
          monthRevenue += (c.enrollment_fee || 0)
        }

        contractRevenue += monthRevenue
        studentIds.add(c.student_id)
      }
    }

    // 講習の月別売上
    for (const l of lectures) {
      const courses = (l.courses || []) as LectureCourse[]
      for (const c of courses) {
        for (const a of c.allocation || []) {
          if (a.year === y && a.month === m && a.lessons > 0) {
            lectureRevenue += c.unit_price * a.lessons
            studentIds.add(l.student_id)
          }
        }
      }
    }

    // 教材販売の月別売上
    for (const ms of materialSales) {
      if (ms.billing_year === y && ms.billing_month === m) {
        materialRevenue += ms.total_amount
        studentIds.add(ms.student_id)
      }
    }

    const revenue = contractRevenue + lectureRevenue + materialRevenue
    months.push({ year: y, month: m, revenue, contractRevenue, lectureRevenue, materialRevenue, count: studentIds.size })
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

      const cStartMonth2 = cStart.getMonth() + 1
      const isFirstMonth = cStart.getFullYear() === targetY && cStartMonth2 === targetM
      const cSecMonth = cStartMonth2 === 12 ? 1 : cStartMonth2 + 1
      const cSecYear = cStartMonth2 === 12 ? cStart.getFullYear() + 1 : cStart.getFullYear()
      const isSecondMonth = cSecYear === targetY && cSecMonth === targetM
      const isHalf = isFirstMonth && cStart.getDate() >= 16

      // 授業料（2ヶ月目が4月なら進級後学年で再計算）
      const gCourses = (c.courses as CourseEntry[]) || []
      let gTuition: number
      if (isSecondMonth && cSecMonth === 4) {
        const ng2 = GRADE_NEXT[c.grade]
        gTuition = ng2 ? calcMonthlyAmount(ng2, gCourses) : c.monthly_amount
      } else if (isHalf) {
        gTuition = Math.floor(c.monthly_amount / 2)
      } else {
        gTuition = c.monthly_amount
      }
      const gFacility = isHalf ? FACILITY_FEE_HALF_TAX_INCL : FACILITY_FEE_MONTHLY_TAX_INCL
      // キャンペーン割引（契約書モデル準拠）
      const gCampaign = (c as Record<string, unknown>).campaign as string || ''
      const gStoredDiscount = c.campaign_discount || 0
      let gCampaignDiscount = 0
      if (gCampaign === '講習キャンペーン' && gStoredDiscount > 0) {
        if (isFirstMonth) {
          gCampaignDiscount = gStoredDiscount * 2
        } else if (isSecondMonth) {
          const gFirstIsHalf = cStart.getDate() >= 16
          const gFirstTuition = gFirstIsHalf ? Math.floor(c.monthly_amount / 2) : c.monthly_amount
          const gFirstTuitionAfterDiscount = gFirstTuition - gStoredDiscount * 2
          if (gFirstTuitionAfterDiscount < 0) gCampaignDiscount = Math.abs(gFirstTuitionAfterDiscount)
        }
      }
      let rev = Math.max(0, gTuition - gCampaignDiscount) + gFacility
      if (isFirstMonth) {
        rev += (c.enrollment_fee || 0)
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

  // --- 講習統計（選択月・学年別） ---
  const lectureGradeRevenue: Record<string, number> = {}
  const lectureGradeLessons: Record<string, number> = {}
  const lectureGradeStudentIds: Record<string, Set<string>> = {}

  for (const l of lectures) {
    const g = (l as { grade?: string }).grade || '未設定'
    const lCourses = (l.courses || []) as LectureCourse[]
    for (const c of lCourses) {
      for (const a of c.allocation || []) {
        if (a.year === targetY && a.month === targetM && a.lessons > 0) {
          if (!lectureGradeStudentIds[g]) lectureGradeStudentIds[g] = new Set()
          lectureGradeStudentIds[g].add(l.student_id)
          lectureGradeLessons[g] = (lectureGradeLessons[g] || 0) + a.lessons
          lectureGradeRevenue[g] = (lectureGradeRevenue[g] || 0) + c.unit_price * a.lessons
        }
      }
    }
  }

  const lectureGradeStats = [...new Set(Object.keys(lectureGradeRevenue))]
    .sort((a, b) => {
      const ai = GRADE_ORDER.indexOf(a)
      const bi = GRADE_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    .map(grade => ({
      grade,
      student_count: lectureGradeStudentIds[grade]?.size || 0,
      total_lessons: lectureGradeLessons[grade] || 0,
      revenue: lectureGradeRevenue[grade] || 0,
    }))

  const totalLectureStudents = lectureGradeStats.reduce((s, g) => s + g.student_count, 0)
  const totalLectureLessons = lectureGradeStats.reduce((s, g) => s + g.total_lessons, 0)
  const totalLectureRevenue = lectureGradeStats.reduce((s, g) => s + g.revenue, 0)

  // --- 教材統計（選択月・学年別） ---
  // student_id → grade マップを構築（契約 + 講習から）
  const studentGradeMap: Record<string, string> = {}
  for (const c of contracts) {
    const cStart = new Date(c.start_date)
    const cEnd = new Date(c.end_date)
    if (cStart <= targetLastDay && cEnd >= targetFirstDay) {
      studentGradeMap[c.student_id] = c.grade || '未設定'
    }
  }
  for (const l of lectures) {
    if (!studentGradeMap[l.student_id]) {
      studentGradeMap[l.student_id] = (l as { grade?: string }).grade || '未設定'
    }
  }

  const materialGradeRevenue: Record<string, number> = {}
  const materialGradeQuantity: Record<string, number> = {}
  const materialGradeStudentIds: Record<string, Set<string>> = {}

  for (const ms of materialSales) {
    if (ms.billing_year === targetY && ms.billing_month === targetM) {
      const g = studentGradeMap[ms.student_id] || '未設定'
      const qty = (ms as { quantity?: number }).quantity || 1
      if (!materialGradeStudentIds[g]) materialGradeStudentIds[g] = new Set()
      materialGradeStudentIds[g].add(ms.student_id)
      materialGradeQuantity[g] = (materialGradeQuantity[g] || 0) + qty
      materialGradeRevenue[g] = (materialGradeRevenue[g] || 0) + ms.total_amount
    }
  }

  const materialGradeStats = [...new Set(Object.keys(materialGradeRevenue))]
    .sort((a, b) => {
      const ai = GRADE_ORDER.indexOf(a)
      const bi = GRADE_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    .map(grade => ({
      grade,
      student_count: materialGradeStudentIds[grade]?.size || 0,
      quantity: materialGradeQuantity[grade] || 0,
      revenue: materialGradeRevenue[grade] || 0,
    }))

  const totalMaterialStudents = materialGradeStats.reduce((s, g) => s + g.student_count, 0)
  const totalMaterialQuantity = materialGradeStats.reduce((s, g) => s + g.quantity, 0)
  const totalMaterialRevenue = materialGradeStats.reduce((s, g) => s + g.revenue, 0)

  return NextResponse.json({
    data: months,
    gradeStats,
    totalGradeStudents,
    totalGradeRevenue,
    totalGradeLessons,
    lectureGradeStats,
    totalLectureStudents,
    totalLectureLessons,
    totalLectureRevenue,
    materialGradeStats,
    totalMaterialStudents,
    totalMaterialQuantity,
    totalMaterialRevenue,
  })
}

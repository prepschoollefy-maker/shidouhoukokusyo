import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyContractPassword } from '@/lib/contracts/auth'
import { FACILITY_FEE_MONTHLY_TAX_INCL, FACILITY_FEE_HALF_TAX_INCL } from '@/lib/contracts/pricing'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const now = new Date()
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(now.getFullYear()))
  const month = parseInt(request.nextUrl.searchParams.get('month') || String(now.getMonth() + 1))

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('contracts')
    .select('*, student:students(id, name, student_number, payment_method)')
    .lte('start_date', lastDay)
    .gte('end_date', firstDay)
    .order('start_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const billing = (data || []).map((c) => {
    const startDate = new Date(c.start_date)
    const startDay = startDate.getDate()
    const startYear = startDate.getFullYear()
    const startMonth = startDate.getMonth() + 1
    const isFirstMonth = startYear === year && startMonth === month

    // 授業料（月謝）: 16日開始の初月は半額
    const isHalf = isFirstMonth && startDay >= 16
    const tuition = isHalf ? Math.floor(c.monthly_amount / 2) : c.monthly_amount

    // 入塾金: 契約開始月のみ
    const enrollmentFee = isFirstMonth ? (c.enrollment_fee || 0) : 0

    // 設備利用料: 16日開始の初月は半額
    const facilityFee = isHalf ? FACILITY_FEE_HALF_TAX_INCL : FACILITY_FEE_MONTHLY_TAX_INCL

    // キャンペーン割引: 契約開始月のみ
    const campaignDiscount = isFirstMonth ? (c.campaign_discount || 0) : 0

    // 合計
    const totalAmount = tuition + enrollmentFee + facilityFee - campaignDiscount

    return {
      ...c,
      tuition,
      enrollment_fee_amount: enrollmentFee,
      facility_fee: facilityFee,
      campaign_discount_amount: campaignDiscount,
      total_amount: totalAmount,
    }
  })

  const contractTotal = billing.reduce((sum, b) => sum + b.total_amount, 0)

  // 講習データ: 当月の allocation を含む講習を集計（lecture_id でグループ化）
  const { data: lectureRows, error: lectureError } = await supabase
    .from('lectures')
    .select('*, student:students(id, name, student_number, payment_method)')

  if (lectureError) return NextResponse.json({ error: lectureError.message }, { status: 500 })

  interface LectureAlloc { year: number; month: number; lessons: number }
  interface LectureCourse { course: string; total_lessons: number; unit_price: number; subtotal: number; allocation: LectureAlloc[] }

  const lectureData: {
    id: string
    student: { id: string; name: string; student_number: string | null; payment_method: string }
    label: string
    grade: string
    courses: { course: string; unit_price: number; lessons: number; amount: number }[]
    total_amount: number
  }[] = []

  for (const l of lectureRows || []) {
    const courses = (l.courses || []) as LectureCourse[]
    const monthCourses: { course: string; unit_price: number; lessons: number; amount: number }[] = []

    for (const c of courses) {
      const monthAlloc = (c.allocation || []).find(
        (a: LectureAlloc) => a.year === year && a.month === month
      )
      if (monthAlloc && monthAlloc.lessons > 0) {
        monthCourses.push({
          course: c.course,
          unit_price: c.unit_price,
          lessons: monthAlloc.lessons,
          amount: c.unit_price * monthAlloc.lessons,
        })
      }
    }

    if (monthCourses.length > 0) {
      lectureData.push({
        id: l.id,
        student: l.student,
        label: l.label,
        grade: l.grade,
        courses: monthCourses,
        total_amount: monthCourses.reduce((sum, c) => sum + c.amount, 0),
      })
    }
  }

  const lectureTotal = lectureData.reduce((sum, l) => sum + l.total_amount, 0)

  // 教材販売データ: 当月の billing_year/month に該当するもの
  // テーブル未作成やRLS等でエラーの場合は空配列で続行（請求全体を壊さない）
  let materialData: {
    id: string
    student: { id: string; name: string; student_number: string | null; payment_method: string }
    item_name: string
    unit_price: number
    quantity: number
    total_amount: number
    sale_date: string
    notes: string
  }[] = []

  const { data: materialRows, error: materialError } = await supabase
    .from('material_sales')
    .select('*, student:students(id, name, student_number, payment_method)')
    .eq('billing_year', year)
    .eq('billing_month', month)
    .order('sale_date', { ascending: true })

  if (!materialError && materialRows) {
    materialData = materialRows.map((m) => ({
      id: m.id,
      student: m.student,
      item_name: m.item_name,
      unit_price: m.unit_price,
      quantity: m.quantity,
      total_amount: m.total_amount,
      sale_date: m.sale_date,
      notes: m.notes,
    }))
  }

  const materialTotal = materialData.reduce((sum, m) => sum + m.total_amount, 0)
  const total = contractTotal + lectureTotal + materialTotal

  return NextResponse.json({ data: billing, lectureData, materialData, total, contractTotal, lectureTotal, materialTotal })
}

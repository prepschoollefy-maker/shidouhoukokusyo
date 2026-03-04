import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyContractPassword } from '@/lib/contracts/auth'
import { FACILITY_FEE_MONTHLY_TAX_INCL, FACILITY_FEE_HALF_TAX_INCL } from '@/lib/contracts/pricing'

function getEffectivePaymentMethod(
  student: { payment_method: string; direct_debit_start_ym: string | null },
  billingYear: number,
  billingMonth: number
): '振込' | '口座振替' {
  if (!student.direct_debit_start_ym) return student.payment_method as '振込' | '口座振替'
  const billingYm = `${billingYear}-${String(billingMonth).padStart(2, '0')}`
  return billingYm >= student.direct_debit_start_ym ? '口座振替' : '振込'
}

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
    .select('*, student:students(id, name, student_number, payment_method, direct_debit_start_ym)')
    .lte('start_date', lastDay)
    .gte('end_date', firstDay)
    .order('start_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const calcContractBilling = (c: Record<string, unknown>, outOfPeriod = false) => {
    const startDate = new Date(c.start_date as string)
    const startDay = startDate.getDate()
    const startYear = startDate.getFullYear()
    const startMonth = startDate.getMonth() + 1
    const isFirstMonth = startYear === year && startMonth === month

    const isHalf = isFirstMonth && startDay >= 16
    const tuition = isHalf ? Math.floor((c.monthly_amount as number) / 2) : (c.monthly_amount as number)
    const enrollmentFee = isFirstMonth ? ((c.enrollment_fee as number) || 0) : 0
    const facilityFee = isHalf ? FACILITY_FEE_HALF_TAX_INCL : FACILITY_FEE_MONTHLY_TAX_INCL
    const campaignDiscount = isFirstMonth ? ((c.campaign_discount as number) || 0) : 0
    const totalAmount = tuition + enrollmentFee + facilityFee - campaignDiscount
    const student = c.student as { id: string; name: string; student_number: string | null; payment_method: string; direct_debit_start_ym: string | null } | null

    return {
      ...c,
      tuition,
      enrollment_fee_amount: enrollmentFee,
      facility_fee: facilityFee,
      campaign_discount_amount: campaignDiscount,
      total_amount: totalAmount,
      effective_payment_method: student ? getEffectivePaymentMethod(student, year, month) : '振込',
      out_of_period: outOfPeriod,
    }
  }

  const billing = (data || []).map((c) => calcContractBilling(c, false))
  const billingContractIds = new Set(billing.map(b => (b as Record<string, unknown>).id as string))

  // 契約期間外だが入金・調整がある契約を追加取得
  const admin = createAdminClient()
  const [paymentRefRes, adjustmentRefRes] = await Promise.all([
    admin.from('payments').select('contract_id').eq('year', year).eq('month', month).not('contract_id', 'is', null),
    admin.from('adjustments').select('contract_id').eq('year', year).eq('month', month).not('contract_id', 'is', null),
  ])
  const extraIds = new Set<string>()
  for (const p of paymentRefRes.data || []) {
    if (p.contract_id && !billingContractIds.has(p.contract_id)) extraIds.add(p.contract_id)
  }
  for (const a of adjustmentRefRes.data || []) {
    if (a.contract_id && !billingContractIds.has(a.contract_id)) extraIds.add(a.contract_id)
  }
  if (extraIds.size > 0) {
    const { data: extraContracts } = await supabase
      .from('contracts')
      .select('*, student:students(id, name, student_number, payment_method, direct_debit_start_ym)')
      .in('id', [...extraIds])
    for (const c of extraContracts || []) {
      billing.push(calcContractBilling(c, true))
    }
  }

  // 契約期間外の行は contractTotal に含めない（請求額サマリーの整合性）
  const contractTotal = billing
    .filter(b => !b.out_of_period)
    .reduce((sum, b) => sum + b.total_amount, 0)

  // 講習データ: 当月の allocation を含む講習を集計（lecture_id でグループ化）
  const { data: lectureRows, error: lectureError } = await supabase
    .from('lectures')
    .select('*, student:students(id, name, student_number, payment_method, direct_debit_start_ym)')

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
    effective_payment_method: '振込' | '口座振替'
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
        effective_payment_method: '振込' as const, // 講習は常に振込
      })
    }
  }

  const lectureTotal = lectureData.reduce((sum, l) => sum + l.total_amount, 0)

  // 教材販売データ: 当月の billing_year/month に該当するもの
  // adminClient を使用（material_sales の RLS は admin only のため）
  let materialData: {
    id: string
    student: { id: string; name: string; student_number: string | null; payment_method: string }
    item_name: string
    unit_price: number
    quantity: number
    total_amount: number
    sale_date: string
    notes: string
    effective_payment_method: '振込' | '口座振替'
  }[] = []

  const { data: materialRows, error: materialError } = await admin
    .from('material_sales')
    .select('*, student:students(id, name, student_number, payment_method, direct_debit_start_ym)')
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
      effective_payment_method: m.student ? getEffectivePaymentMethod(m.student, year, month) : '振込' as const,
    }))
  }

  const materialTotal = materialData.reduce((sum, m) => sum + m.total_amount, 0)

  // 返金・調整データ: 当月の year/month に該当するもの
  let adjustmentData: {
    id: string
    student: { id: string; name: string; student_number: string | null }
    amount: number
    reason: string
    status: string
    completed_date: string | null
    notes: string
    created_at: string
    contract_id: string | null
    lecture_id: string | null
    material_sale_id: string | null
    linked_label: string | null
  }[] = []

  const { data: adjustmentRows, error: adjustmentError } = await admin
    .from('adjustments')
    .select('*, student:students(id, name, student_number), contract:contracts(id, courses, grade), lecture:lectures(id, label, grade), material_sale:material_sales(id, item_name)')
    .eq('year', year)
    .eq('month', month)
    .order('created_at', { ascending: true })

  if (!adjustmentError && adjustmentRows) {
    adjustmentData = adjustmentRows.map((a) => {
      // 紐付き先のラベルを生成
      let linked_label: string | null = null
      if (a.contract_id && a.contract) {
        const courses = ((a.contract as Record<string, unknown>).courses || []) as { course: string }[]
        const courseNames = courses.map((c: { course: string }) => c.course).join(', ')
        linked_label = `通常コース: ${courseNames || '不明'}`
      } else if (a.lecture_id && a.lecture) {
        linked_label = `講習: ${(a.lecture as Record<string, unknown>).label || '不明'}`
      } else if (a.material_sale_id && a.material_sale) {
        linked_label = `教材: ${(a.material_sale as Record<string, unknown>).item_name || '不明'}`
      }
      return {
        id: a.id,
        student: a.student,
        amount: a.amount,
        reason: a.reason,
        status: a.status,
        completed_date: a.completed_date,
        notes: a.notes,
        created_at: a.created_at,
        contract_id: a.contract_id || null,
        lecture_id: a.lecture_id || null,
        material_sale_id: a.material_sale_id || null,
        linked_label,
      }
    })
  }

  const adjustmentTotal = adjustmentData.reduce((sum, a) => sum + a.amount, 0)
  const total = contractTotal + lectureTotal + materialTotal + adjustmentTotal

  return NextResponse.json({ data: billing, lectureData, materialData, adjustmentData, total, contractTotal, lectureTotal, materialTotal, adjustmentTotal })
}

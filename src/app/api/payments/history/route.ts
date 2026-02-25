import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyContractPassword } from '@/lib/contracts/auth'
import { FACILITY_FEE_MONTHLY_TAX_INCL, FACILITY_FEE_HALF_TAX_INCL } from '@/lib/contracts/pricing'

interface LectureAlloc { year: number; month: number; lessons: number }
interface LectureCourse { course: string; total_lessons: number; unit_price: number; subtotal: number; allocation: LectureAlloc[] }

/**
 * 指定年月の請求額を計算するヘルパー（billing API と同じロジック）
 */
function calcContractBilled(c: Record<string, unknown>, year: number, month: number): number {
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

  return tuition + enrollmentFee + facilityFee - campaignDiscount
}

function calcLectureBilled(l: Record<string, unknown>, year: number, month: number): number {
  const courses = (l.courses || []) as LectureCourse[]
  let total = 0
  for (const c of courses) {
    const alloc = (c.allocation || []).find(
      (a: LectureAlloc) => a.year === year && a.month === month
    )
    if (alloc && alloc.lessons > 0) {
      total += c.unit_price * alloc.lessons
    }
  }
  return total
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const params = request.nextUrl.searchParams
  const view = params.get('view') || 'monthly'
  const now = new Date()
  const year = parseInt(params.get('year') || String(now.getFullYear()))
  const months = parseInt(params.get('months') || '12')

  // 対象期間（year年1月 から months ヶ月分、最新月優先）
  const targetMonths: { year: number; month: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(year, 11 - i, 1) // year年12月からさかのぼる
    targetMonths.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }

  // payments を全期間分取得（admin client で RLS バイパス）
  const admin = createAdminClient()
  const startYM = targetMonths[0]
  const endYM = targetMonths[targetMonths.length - 1]
  let paymentsQuery = admin
    .from('payments')
    .select('*')

  // year/month フィルタ
  if (startYM.year === endYM.year) {
    paymentsQuery = paymentsQuery
      .eq('year', startYM.year)
      .gte('month', startYM.month)
      .lte('month', endYM.month)
  } else {
    // 複数年にまたがる場合は or フィルタ
    const conditions = targetMonths.map(t => `and(year.eq.${t.year},month.eq.${t.month})`)
    paymentsQuery = paymentsQuery.or(conditions.join(','))
  }

  const { data: allPayments, error: payErr } = await paymentsQuery
  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 })

  if (view === 'monthly') {
    return handleMonthly(supabase, targetMonths, allPayments || [])
  } else {
    return handleStudent(supabase, targetMonths, allPayments || [])
  }
}

async function handleMonthly(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetMonths: { year: number; month: number }[],
  allPayments: Record<string, unknown>[],
) {
  // 各月の請求額を計算するため contracts と lectures を取得
  // 全期間の開始日〜終了日
  const first = targetMonths[0]
  const last = targetMonths[targetMonths.length - 1]
  const rangeStart = `${first.year}-${String(first.month).padStart(2, '0')}-01`
  const rangeEndDate = new Date(last.year, last.month, 0)
  const rangeEnd = rangeEndDate.toISOString().split('T')[0]

  const [contractsRes, lecturesRes] = await Promise.all([
    supabase.from('contracts').select('*').lte('start_date', rangeEnd).gte('end_date', rangeStart),
    supabase.from('lectures').select('*'),
  ])

  const contracts = contractsRes.data || []
  const lectures = lecturesRes.data || []

  const result = targetMonths.map(({ year, month }) => {
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).toISOString().split('T')[0]

    // 当月の contract 請求額を計算
    const monthContracts = contracts.filter(c => c.start_date <= lastDay && c.end_date >= firstDay)
    let totalBilled = 0
    let totalItems = 0

    for (const c of monthContracts) {
      totalBilled += calcContractBilled(c, year, month)
      totalItems++
    }

    // 当月の lecture 請求額を計算
    for (const l of lectures) {
      const amt = calcLectureBilled(l, year, month)
      if (amt > 0) {
        totalBilled += amt
        totalItems++
      }
    }

    // payments 集計
    const monthPayments = (allPayments as Record<string, unknown>[]).filter(
      p => (p.year as number) === year && (p.month as number) === month
    )

    const totalPaid = monthPayments.reduce((s, p) => s + ((p.paid_amount as number) || 0), 0)
    const paidCount = monthPayments.filter(p => (p.status as string) === '入金済み').length
    const unpaidCount = totalItems - monthPayments.length // payment レコードがない = 未入金
      + monthPayments.filter(p => (p.status as string) === '未入金').length
    const discrepancyCount = monthPayments.filter(p => (p.status as string) === '過不足あり').length
    const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 1000) / 10 : 0

    return {
      year,
      month,
      total_billed: totalBilled,
      total_paid: totalPaid,
      paid_count: paidCount,
      unpaid_count: unpaidCount,
      discrepancy_count: discrepancyCount,
      total_items: totalItems,
      collection_rate: collectionRate,
    }
  })

  return NextResponse.json({ data: result })
}

async function handleStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetMonths: { year: number; month: number }[],
  allPayments: Record<string, unknown>[],
) {
  const first = targetMonths[0]
  const last = targetMonths[targetMonths.length - 1]
  const rangeStart = `${first.year}-${String(first.month).padStart(2, '0')}-01`
  const rangeEndDate = new Date(last.year, last.month, 0)
  const rangeEnd = rangeEndDate.toISOString().split('T')[0]

  const [contractsRes, lecturesRes, studentsRes] = await Promise.all([
    supabase.from('contracts').select('*, student:students(id, name, student_number)').lte('start_date', rangeEnd).gte('end_date', rangeStart),
    supabase.from('lectures').select('*, student:students(id, name, student_number)'),
    supabase.from('students').select('id, name, student_number'),
  ])

  const contracts = contractsRes.data || []
  const lectures = lecturesRes.data || []

  // payments を contract_id / lecture_id でマッピング
  const paymentsByContract = new Map<string, Record<string, unknown>[]>()
  const paymentsByLecture = new Map<string, Record<string, unknown>[]>()
  for (const p of allPayments) {
    if (p.contract_id) {
      const arr = paymentsByContract.get(p.contract_id as string) || []
      arr.push(p)
      paymentsByContract.set(p.contract_id as string, arr)
    }
    if (p.lecture_id) {
      const arr = paymentsByLecture.get(p.lecture_id as string) || []
      arr.push(p)
      paymentsByLecture.set(p.lecture_id as string, arr)
    }
  }

  // 生徒ごとに集約
  const studentMap = new Map<string, {
    student_id: string
    student_name: string
    student_number: string | null
    months: { year: number; month: number; billing_type: string; billed_amount: number; paid_amount: number; status: string }[]
    total_billed: number
    total_paid: number
  }>()

  const getOrCreate = (studentId: string, studentName: string, studentNumber: string | null) => {
    if (!studentMap.has(studentId)) {
      studentMap.set(studentId, {
        student_id: studentId,
        student_name: studentName,
        student_number: studentNumber,
        months: [],
        total_billed: 0,
        total_paid: 0,
      })
    }
    return studentMap.get(studentId)!
  }

  // contracts の請求を生徒別に振り分け
  for (const c of contracts) {
    const student = c.student as { id: string; name: string; student_number: string | null } | null
    if (!student) continue

    const entry = getOrCreate(student.id, student.name, student.student_number)
    const cPayments = paymentsByContract.get(c.id) || []

    for (const { year, month } of targetMonths) {
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).toISOString().split('T')[0]
      if (c.start_date > lastDay || c.end_date < firstDay) continue

      const billedAmount = calcContractBilled(c, year, month)
      const payment = cPayments.find(p => (p.year as number) === year && (p.month as number) === month)
      const paidAmount = payment ? (payment.paid_amount as number) || 0 : 0
      const status = payment ? (payment.status as string) : '未入金'

      entry.months.push({ year, month, billing_type: 'contract', billed_amount: billedAmount, paid_amount: paidAmount, status })
      entry.total_billed += billedAmount
      entry.total_paid += paidAmount
    }
  }

  // lectures の請求を生徒別に振り分け
  for (const l of lectures) {
    const student = l.student as { id: string; name: string; student_number: string | null } | null
    if (!student) continue

    const entry = getOrCreate(student.id, student.name, student.student_number)
    const lPayments = paymentsByLecture.get(l.id) || []

    for (const { year, month } of targetMonths) {
      const billedAmount = calcLectureBilled(l, year, month)
      if (billedAmount === 0) continue

      const payment = lPayments.find(p => (p.year as number) === year && (p.month as number) === month)
      const paidAmount = payment ? (payment.paid_amount as number) || 0 : 0
      const status = payment ? (payment.status as string) : '未入金'

      entry.months.push({ year, month, billing_type: 'lecture', billed_amount: billedAmount, paid_amount: paidAmount, status })
      entry.total_billed += billedAmount
      entry.total_paid += paidAmount
    }
  }

  const data = Array.from(studentMap.values()).map(s => ({
    ...s,
    outstanding: s.total_billed - s.total_paid,
  }))

  // 未収金額の降順ソート
  data.sort((a, b) => b.outstanding - a.outstanding)

  return NextResponse.json({ data })
}

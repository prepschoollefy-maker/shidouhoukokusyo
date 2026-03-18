import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FACILITY_FEE_MONTHLY_TAX_INCL, FACILITY_FEE_HALF_TAX_INCL } from '@/lib/contracts/pricing'

/**
 * 生徒別の請求履歴を月別に返すAPI
 * GET /api/students/[id]/billing-history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // 全データを並列取得
  const [contractsRes, lecturesRes, materialsRes, manualsRes, adjustmentsRes, paymentsRes, suspensionsRes] = await Promise.all([
    supabase.from('contracts').select('id, start_date, end_date, grade, courses, monthly_amount, enrollment_fee, campaign_discount').eq('student_id', studentId).order('start_date'),
    supabase.from('lectures').select('id, label, grade, courses').eq('student_id', studentId),
    admin.from('material_sales').select('id, item_name, unit_price, quantity, total_amount, billing_year, billing_month, sale_date').eq('student_id', studentId).order('sale_date'),
    admin.from('manual_billings').select('id, amount, description, year, month, notes').eq('student_id', studentId).order('year').order('month'),
    admin.from('adjustments').select('id, amount, reason, status, year, month, notes, contract_id, lecture_id, material_sale_id').eq('student_id', studentId).order('year').order('month'),
    admin.from('payments').select('id, billing_type, contract_id, lecture_id, material_sale_id, manual_billing_id, year, month, billed_amount, paid_amount, difference, status, payment_date, payment_method').eq('student_id', studentId),
    admin.from('student_suspensions').select('start_ym, end_ym').eq('student_id', studentId),
  ])

  const contracts = contractsRes.data || []
  const lectures = lecturesRes.data || []
  const materials = materialsRes.data || []
  const manuals = manualsRes.data || []
  const adjustments = adjustmentsRes.data || []
  const allPayments = paymentsRes.data || []
  const suspensions = suspensionsRes.data || []

  // 対象月の範囲を計算（契約開始月〜現在月）
  interface MonthEntry {
    year: number
    month: number
    items: {
      type: 'contract' | 'lecture' | 'material' | 'manual' | 'adjustment'
      id: string
      label: string
      amount: number
      detail?: string
      payment?: { status: string; paid_amount: number; payment_date: string | null } | null
    }[]
    total: number
    suspended: boolean
  }

  const now = new Date()
  const currentYm = now.getFullYear() * 12 + now.getMonth()

  // 全ての請求が発生する月を収集
  const monthSet = new Set<string>()

  // 契約から月を生成
  interface LectureAlloc { year: number; month: number; lessons: number }
  interface LectureCourse { course: string; total_lessons: number; unit_price: number; subtotal: number; allocation: LectureAlloc[] }

  for (const c of contracts) {
    const start = new Date(c.start_date)
    const end = new Date(c.end_date)
    const startYm = start.getFullYear() * 12 + start.getMonth()
    const endYm = Math.min(end.getFullYear() * 12 + end.getMonth(), currentYm)
    for (let ym = startYm; ym <= endYm; ym++) {
      monthSet.add(`${Math.floor(ym / 12)}-${(ym % 12) + 1}`)
    }
  }
  for (const m of materials) monthSet.add(`${m.billing_year}-${m.billing_month}`)
  for (const m of manuals) monthSet.add(`${m.year}-${m.month}`)
  for (const a of adjustments) monthSet.add(`${a.year}-${a.month}`)
  for (const l of lectures) {
    for (const c of (l.courses || []) as LectureCourse[]) {
      for (const a of c.allocation || []) {
        if (a.lessons > 0) monthSet.add(`${a.year}-${a.month}`)
      }
    }
  }

  // 月ごとに集計
  const months: MonthEntry[] = []

  for (const key of [...monthSet].sort((a, b) => {
    const [ay, am] = a.split('-').map(Number)
    const [by, bm] = b.split('-').map(Number)
    return (by * 12 + bm) - (ay * 12 + am) // 新しい月が先
  })) {
    const [y, m] = key.split('-').map(Number)
    const ym = `${y}-${String(m).padStart(2, '0')}`
    const firstDay = new Date(y, m - 1, 1)
    const lastDay = new Date(y, m, 0)

    const isSuspended = suspensions.some(s => s.start_ym <= ym && s.end_ym >= ym)

    const items: MonthEntry['items'] = []

    // 契約
    for (const c of contracts) {
      const cStart = new Date(c.start_date)
      const cEnd = new Date(c.end_date)
      if (cStart > lastDay || cEnd < firstDay) continue

      const startMonth = cStart.getMonth() + 1
      const startYear = cStart.getFullYear()
      const isFirstMonth = startYear === y && startMonth === m
      const secondMonth = startMonth === 12 ? 1 : startMonth + 1
      const secondYear = startMonth === 12 ? startYear + 1 : startYear
      const isSecondMonth = secondYear === y && secondMonth === m
      const isHalf = isFirstMonth && cStart.getDate() >= 16

      let amount: number
      if (isSuspended) {
        amount = 0
      } else {
        const tuition = isHalf ? Math.floor(c.monthly_amount / 2) : c.monthly_amount
        const facilityFee = isHalf ? FACILITY_FEE_HALF_TAX_INCL : FACILITY_FEE_MONTHLY_TAX_INCL
        const enrollmentFee = isFirstMonth ? (c.enrollment_fee || 0) : 0
        const campaignDiscount = (isFirstMonth || isSecondMonth) ? (c.campaign_discount || 0) : 0
        amount = tuition + facilityFee + enrollmentFee - campaignDiscount
      }

      const courses = (c.courses || []) as { course: string; lessons: number }[]
      const courseLabel = courses.map(co => `${co.course} ${co.lessons}コマ`).join(', ')
      const pmt = allPayments.find(p => p.contract_id === c.id && p.year === y && p.month === m)

      items.push({
        type: 'contract',
        id: c.id,
        label: `通常コース（${courseLabel}）`,
        amount,
        detail: isHalf ? '半月' : undefined,
        payment: pmt ? { status: pmt.status, paid_amount: pmt.paid_amount, payment_date: pmt.payment_date } : null,
      })
    }

    // 講習
    for (const l of lectures) {
      const courses = (l.courses || []) as LectureCourse[]
      let lectureAmount = 0
      for (const c of courses) {
        const alloc = (c.allocation || []).find((a: LectureAlloc) => a.year === y && a.month === m)
        if (alloc && alloc.lessons > 0) {
          lectureAmount += c.unit_price * alloc.lessons
        }
      }
      if (lectureAmount > 0) {
        const pmt = allPayments.find(p => p.lecture_id === l.id && p.year === y && p.month === m)
        items.push({
          type: 'lecture',
          id: l.id,
          label: `講習（${l.label}）`,
          amount: lectureAmount,
          payment: pmt ? { status: pmt.status, paid_amount: pmt.paid_amount, payment_date: pmt.payment_date } : null,
        })
      }
    }

    // 教材
    for (const mat of materials) {
      if (mat.billing_year === y && mat.billing_month === m) {
        const pmt = allPayments.find(p => p.material_sale_id === mat.id && p.year === y && p.month === m)
        items.push({
          type: 'material',
          id: mat.id,
          label: `教材（${mat.item_name} x${mat.quantity}）`,
          amount: mat.total_amount,
          payment: pmt ? { status: pmt.status, paid_amount: pmt.paid_amount, payment_date: pmt.payment_date } : null,
        })
      }
    }

    // 手動請求
    for (const mb of manuals) {
      if (mb.year === y && mb.month === m) {
        const pmt = allPayments.find(p => p.manual_billing_id === mb.id && p.year === y && p.month === m)
        items.push({
          type: 'manual',
          id: mb.id,
          label: `個別請求（${mb.description}）`,
          amount: mb.amount,
          payment: pmt ? { status: pmt.status, paid_amount: pmt.paid_amount, payment_date: pmt.payment_date } : null,
        })
      }
    }

    // 調整
    for (const adj of adjustments) {
      if (adj.year === y && adj.month === m) {
        items.push({
          type: 'adjustment',
          id: adj.id,
          label: `調整（${adj.reason}）`,
          amount: adj.amount,
        })
      }
    }

    if (items.length > 0) {
      months.push({
        year: y,
        month: m,
        items,
        total: items.reduce((s, i) => s + i.amount, 0),
        suspended: isSuspended,
      })
    }
  }

  return NextResponse.json({ data: months })
}

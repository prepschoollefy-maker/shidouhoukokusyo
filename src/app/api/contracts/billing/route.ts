import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyContractPassword } from '@/lib/contracts/auth'
import {
  FACILITY_FEE_MONTHLY_TAX_INCL, FACILITY_FEE_HALF_TAX_INCL,
  GRADE_NEXT, calcMonthlyAmount, type CourseEntry,
} from '@/lib/contracts/pricing'

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
    const secondMonth = startMonth === 12 ? 1 : startMonth + 1
    const secondYear = startMonth === 12 ? startYear + 1 : startYear
    const isSecondMonth = secondYear === year && secondMonth === month

    const isHalf = isFirstMonth && startDay >= 16
    const grade = c.grade as string
    const courses = (c.courses as CourseEntry[]) || []
    const campaign = (c.campaign as string) || ''
    const storedMonthlyAmount = c.monthly_amount as number
    const storedCampaignDiscount = (c.campaign_discount as number) || 0

    // --- 授業料: 2ヶ月目が4月なら進級後学年で再計算 ---
    let tuition: number
    if (isSecondMonth && secondMonth === 4) {
      const ng = GRADE_NEXT[grade]
      tuition = ng ? calcMonthlyAmount(ng, courses) : storedMonthlyAmount
    } else if (isHalf) {
      tuition = Math.floor(storedMonthlyAmount / 2)
    } else {
      tuition = storedMonthlyAmount
    }

    const enrollmentFee = isFirstMonth ? ((c.enrollment_fee as number) || 0) : 0
    const facilityFee = isHalf ? FACILITY_FEE_HALF_TAX_INCL : FACILITY_FEE_MONTHLY_TAX_INCL

    // --- キャンペーン割引（契約書モデル準拠: 初月に2コマ分全額適用） ---
    let campaignDiscount = 0
    if (campaign === '講習キャンペーン' && storedCampaignDiscount > 0) {
      if (isFirstMonth) {
        // 初月: 2コマ分の割引を全額適用（税込 campaign_discount × 2）
        campaignDiscount = storedCampaignDiscount * 2
      } else if (isSecondMonth) {
        // 翌月: 初月の授業料部分がマイナスだった場合の繰越分を計算して適用
        const firstIsHalf = startDay >= 16
        const firstTuition = firstIsHalf ? Math.floor(storedMonthlyAmount / 2) : storedMonthlyAmount
        const firstTuitionAfterDiscount = firstTuition - storedCampaignDiscount * 2
        if (firstTuitionAfterDiscount < 0) {
          campaignDiscount = Math.abs(firstTuitionAfterDiscount)
        }
      }
    }

    // 授業料 - キャンペーン割引（マイナスなら授業料部分は0、設備利用料は必ず請求）
    const tuitionAfterDiscount = Math.max(0, tuition - campaignDiscount)
    const totalAmount = enrollmentFee + tuitionAfterDiscount + facilityFee
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

  const billingYm = `${year}-${String(month).padStart(2, '0')}`

  const billing = (data || []).map((c) => calcContractBilling(c, false))
  const billingContractIds = new Set(billing.map(b => (b as Record<string, unknown>).id as string))

  // 契約期間外だが入金・調整がある契約を追加取得
  const admin = createAdminClient()

  // 休塾中の生徒を取得
  const { data: suspensionRows } = await admin
    .from('student_suspensions')
    .select('student_id')
    .lte('start_ym', billingYm)
    .gte('end_ym', billingYm)
  const suspendedStudentIds = new Set((suspensionRows || []).map(s => s.student_id))
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

  // 休塾中の生徒は請求額を0にする
  for (const b of billing) {
    const rec = b as Record<string, unknown>
    const student = rec.student as { id: string } | null
    if (student?.id && suspendedStudentIds.has(student.id)) {
      b.tuition = 0
      b.facility_fee = 0
      b.enrollment_fee_amount = 0
      b.campaign_discount_amount = 0
      b.total_amount = 0
      rec.suspended = true
    }
  }

  // 上書きデータを取得
  const { data: overrides } = await admin
    .from('billing_overrides')
    .select('*')
    .eq('year', year)
    .eq('month', month)
  const overrideMap = new Map<string, { id: string; override_type: string; override_amount: number | null; reason: string }>()
  for (const o of overrides || []) {
    overrideMap.set(`${o.billing_type}:${o.ref_id}`, { id: o.id, override_type: o.override_type, override_amount: o.override_amount, reason: o.reason })
  }

  // 確定データを取得
  const { data: confirmations } = await admin
    .from('billing_confirmations')
    .select('*')
    .eq('year', year)
    .eq('month', month)

  // 確定データをマップ化（billing_type:ref_id → confirmation）
  const confirmationMap = new Map<string, { id: string; snapshot: Record<string, unknown>; confirmed_at: string }>()
  for (const c of confirmations || []) {
    confirmationMap.set(`${c.billing_type}:${c.ref_id}`, { id: c.id, snapshot: c.snapshot, confirmed_at: c.confirmed_at })
  }

  // 確定済み契約: スナップショットの金額で上書き
  for (const b of billing) {
    const rec = b as Record<string, unknown>
    const conf = confirmationMap.get(`contract:${rec.id as string}`)
    if (conf) {
      const snap = conf.snapshot as Record<string, unknown>
      // 計算値と確定値が異なるか判定
      const currentTotal = b.total_amount
      const snapTotal = (snap.total_amount as number) ?? currentTotal
      rec.confirmed = true
      rec.confirmation_id = conf.id
      rec.confirmed_at = conf.confirmed_at
      rec.amount_changed = currentTotal !== snapTotal
      // スナップショットで金額を上書き
      b.tuition = (snap.tuition as number) ?? b.tuition
      b.enrollment_fee_amount = (snap.enrollment_fee as number) ?? b.enrollment_fee_amount
      b.facility_fee = (snap.facility_fee as number) ?? b.facility_fee
      b.campaign_discount_amount = (snap.campaign_discount as number) ?? b.campaign_discount_amount
      b.total_amount = snapTotal
      if (snap.suspended !== undefined) rec.suspended = snap.suspended
    }
  }

  // 未確定の契約にoverrideを適用
  for (const b of billing) {
    const rec = b as Record<string, unknown>
    if (rec.confirmed) continue // 確定済みはスキップ
    const ov = overrideMap.get(`contract:${rec.id as string}`)
    if (ov) {
      rec.override_id = ov.id
      rec.override_reason = ov.reason
      if (ov.override_type === 'exclude') {
        rec.excluded = true
        b.tuition = 0
        b.facility_fee = 0
        b.enrollment_fee_amount = 0
        b.campaign_discount_amount = 0
        b.total_amount = 0
      } else if (ov.override_type === 'amount' && ov.override_amount != null) {
        rec.overridden = true
        rec.original_amount = b.total_amount
        b.total_amount = ov.override_amount
      }
    }
  }

  // 契約期間外・除外の行は contractTotal に含めない
  const contractTotal = billing
    .filter(b => !b.out_of_period && !(b as Record<string, unknown>).excluded)
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

  // 確定済み講習: スナップショットの金額で上書き
  for (const l of lectureData) {
    const conf = confirmationMap.get(`lecture:${l.id}`)
    if (conf) {
      const snap = conf.snapshot as Record<string, unknown>
      const currentTotal = l.total_amount
      const snapTotal = (snap.total_amount as number) ?? currentTotal
      ;(l as Record<string, unknown>).confirmed = true
      ;(l as Record<string, unknown>).confirmation_id = conf.id
      ;(l as Record<string, unknown>).confirmed_at = conf.confirmed_at
      ;(l as Record<string, unknown>).amount_changed = currentTotal !== snapTotal
      l.total_amount = snapTotal
    }
  }

  // 未確定の講習にoverrideを適用
  for (const l of lectureData) {
    const rec = l as Record<string, unknown>
    if (rec.confirmed) continue
    const ov = overrideMap.get(`lecture:${l.id}`)
    if (ov) {
      rec.override_id = ov.id
      rec.override_reason = ov.reason
      if (ov.override_type === 'exclude') {
        rec.excluded = true
        l.total_amount = 0
      } else if (ov.override_type === 'amount' && ov.override_amount != null) {
        rec.overridden = true
        rec.original_amount = l.total_amount
        l.total_amount = ov.override_amount
      }
    }
  }

  const lectureTotal = lectureData.filter(l => !(l as Record<string, unknown>).excluded).reduce((sum, l) => sum + l.total_amount, 0)

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

  // 確定済み教材: スナップショットの金額で上書き
  for (const m of materialData) {
    const conf = confirmationMap.get(`material:${m.id}`)
    if (conf) {
      const snap = conf.snapshot as Record<string, unknown>
      const currentTotal = m.total_amount
      const snapTotal = (snap.total_amount as number) ?? currentTotal
      ;(m as Record<string, unknown>).confirmed = true
      ;(m as Record<string, unknown>).confirmation_id = conf.id
      ;(m as Record<string, unknown>).confirmed_at = conf.confirmed_at
      ;(m as Record<string, unknown>).amount_changed = currentTotal !== snapTotal
      m.total_amount = snapTotal
    }
  }

  // 未確定の教材にoverrideを適用
  for (const m of materialData) {
    const rec = m as Record<string, unknown>
    if (rec.confirmed) continue
    const ov = overrideMap.get(`material:${m.id}`)
    if (ov) {
      rec.override_id = ov.id
      rec.override_reason = ov.reason
      if (ov.override_type === 'exclude') {
        rec.excluded = true
        m.total_amount = 0
      } else if (ov.override_type === 'amount' && ov.override_amount != null) {
        rec.overridden = true
        rec.original_amount = m.total_amount
        m.total_amount = ov.override_amount
      }
    }
  }

  const materialTotal = materialData.filter(m => !(m as Record<string, unknown>).excluded).reduce((sum, m) => sum + m.total_amount, 0)

  // 手動請求データ: 当月の year/month に該当するもの
  let manualData: {
    id: string
    student: { id: string; name: string; student_number: string | null; payment_method: string; direct_debit_start_ym: string | null }
    amount: number
    description: string
    notes: string
    created_at: string
    effective_payment_method: '振込' | '口座振替'
  }[] = []

  const { data: manualRows, error: manualError } = await admin
    .from('manual_billings')
    .select('*, student:students(id, name, student_number, payment_method, direct_debit_start_ym)')
    .eq('year', year)
    .eq('month', month)
    .order('created_at', { ascending: true })

  if (!manualError && manualRows) {
    manualData = manualRows.map((m) => ({
      id: m.id,
      student: m.student,
      amount: m.amount,
      description: m.description,
      notes: m.notes,
      created_at: m.created_at,
      effective_payment_method: m.student ? getEffectivePaymentMethod(m.student, year, month) : '振込' as const,
    }))
  }

  // 確定済み手動請求: スナップショットの金額で上書き
  for (const m of manualData) {
    const conf = confirmationMap.get(`manual:${m.id}`)
    if (conf) {
      const snap = conf.snapshot as Record<string, unknown>
      const currentAmount = m.amount
      const snapAmount = (snap.amount as number) ?? currentAmount
      ;(m as Record<string, unknown>).confirmed = true
      ;(m as Record<string, unknown>).confirmation_id = conf.id
      ;(m as Record<string, unknown>).confirmed_at = conf.confirmed_at
      ;(m as Record<string, unknown>).amount_changed = currentAmount !== snapAmount
      m.amount = snapAmount
    }
  }

  // 未確定の手動請求にoverrideを適用
  for (const m of manualData) {
    const rec = m as Record<string, unknown>
    if (rec.confirmed) continue
    const ov = overrideMap.get(`manual:${m.id}`)
    if (ov) {
      rec.override_id = ov.id
      rec.override_reason = ov.reason
      if (ov.override_type === 'exclude') {
        rec.excluded = true
        m.amount = 0
      } else if (ov.override_type === 'amount' && ov.override_amount != null) {
        rec.overridden = true
        rec.original_amount = m.amount
        m.amount = ov.override_amount
      }
    }
  }

  const manualTotal = manualData.filter(m => !(m as Record<string, unknown>).excluded).reduce((sum, m) => sum + m.amount, 0)

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
  const total = contractTotal + lectureTotal + materialTotal + manualTotal + adjustmentTotal

  return NextResponse.json({ data: billing, lectureData, materialData, manualData, adjustmentData, total, contractTotal, lectureTotal, materialTotal, manualTotal, adjustmentTotal })
}

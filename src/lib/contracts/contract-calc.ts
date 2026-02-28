/**
 * 契約書印刷用の詳細計算ロジック（pricing.py の calculate_all / calculate_keizoku を移植）
 * 税抜ベースで計算し、最終的に税込を算出する。
 */

import {
  GRADE_CATEGORY_MAP, Grade, COURSE_PRICES, LESSON_DISCOUNT, TAX_RATE,
} from './pricing'

const FACILITY_FEE_MONTHLY = 3000 // 税抜
const ENROLLMENT_FEE = 33000 // 税込

const CAMPAIGN_DISCOUNT_TAX_INCL: Record<string, number> = {
  'ハイ_小3-小5': 10500,
  'ハイ_小6': 12000,
  'ハイ_中1/2': 11100,
  'ハイ_中3/高1': 11400,
  'ハイ_高2/高3': 12000,
}

interface TuitionRow {
  label: string
  grade: string
  duration: string
  frequency: string
  amount: number
}

export interface ContractCalcResult {
  // 日付
  入塾日: string
  退塾日: string
  翌月末: string
  翌月初: string
  初回月謝ラベル: string
  month1: number
  month2: number
  // 初回月謝テーブル
  initial_rows: TuitionRow[]
  g26: number // 授業料合計
  equip_desc: string
  g27: number // 設備利用料
  g28: number // 複数コマ受講割引
  g29: number // 合計（税抜）
  g30: number // 合計（税込）
  // 定額月謝テーブル
  regular_rows: TuitionRow[]
  m26: number
  m27: number
  m28: number
  m29: number
  m30: number
  // 支払い
  enrollment_fee: number
  first_tuition: number
  first_total: number
  regular_monthly: number
}

function nextMonth(m: number): number {
  return m === 12 ? 1 : m + 1
}

function calcEndOfNextMonth(year: number, month: number): Date {
  let m = month + 1
  let y = year
  if (m > 12) { m -= 12; y += 1 }
  return new Date(y, m, 0) // last day of month m
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function getPrice(course: string, grade: string): number {
  const category = GRADE_CATEGORY_MAP[grade as Grade]
  if (!category) return 0
  return COURSE_PRICES[`${course}_${category}`] || 0
}

function getDiscount(lessons: number): number {
  return LESSON_DISCOUNT[lessons] || 0
}

export function calculateAll(
  grade: string,
  startDate: string, // YYYY-MM-DD
  endDate: string,
  courses: { course: string; lessons: number }[],
  campaign: string,
): ContractCalcResult {
  const sd = new Date(startDate + 'T00:00:00')
  const ed = new Date(endDate + 'T00:00:00')
  const startDay = sd.getDate()
  const startMonth = sd.getMonth() + 1
  const startYear = sd.getFullYear()
  const isHalf = startDay >= 16

  const course1 = courses[0]?.course || ''
  const course1Lessons = courses[0]?.lessons || 0
  const course2 = courses.length > 1 ? courses[1]?.course : ''
  const course2Lessons = courses.length > 1 ? courses[1]?.lessons || 0 : 0
  const hasCourse2 = !!course2 && course2Lessons > 0

  const unit1 = getPrice(course1, grade)
  const unit2 = hasCourse2 ? getPrice(course2, grade) : 0

  const month1 = startMonth
  const month2 = nextMonth(startMonth)

  // 初回月謝計算
  let g22 = unit1 * course1Lessons * (isHalf ? 0.5 : 1)
  const g23 = unit1 * course1Lessons
  const m22 = unit1 * course1Lessons

  const g24 = hasCourse2 ? unit2 * course2Lessons * (isHalf ? 0.5 : 1) : 0
  const g25 = hasCourse2 ? unit2 * course2Lessons : 0
  const m23 = hasCourse2 ? unit2 * course2Lessons : 0

  // キャンペーン割引
  if (campaign === '講習キャンペーン') {
    const category = GRADE_CATEGORY_MAP[grade as Grade]
    if (category) {
      const taxIncl = CAMPAIGN_DISCOUNT_TAX_INCL[`${course1}_${category}`] || 0
      if (taxIncl > 0) {
        g22 -= (taxIncl / 1.1) * 2
      }
    }
  }

  const g26 = g22 + g23 + g24 + g25
  const m26 = m22 + m23

  // 設備利用料
  let g27: number, equipDesc: string
  if (isHalf) {
    g27 = FACILITY_FEE_MONTHLY / 2 + FACILITY_FEE_MONTHLY
    equipDesc = `${month1}月：${(FACILITY_FEE_MONTHLY / 2).toLocaleString()}円　　${month2}月：${FACILITY_FEE_MONTHLY.toLocaleString()}円`
  } else {
    g27 = FACILITY_FEE_MONTHLY * 2
    equipDesc = `${month1}月：${FACILITY_FEE_MONTHLY.toLocaleString()}円　　${month2}月：${FACILITY_FEE_MONTHLY.toLocaleString()}円`
  }
  const m27 = FACILITY_FEE_MONTHLY

  // 複数コマ受講割引
  const disc1 = getDiscount(course1Lessons)
  const disc2 = hasCourse2 ? getDiscount(course2Lessons) : 0
  const g28 = isHalf ? (disc1 + disc2) * 1.5 : (disc1 + disc2) * 2
  const m28 = isHalf ? g28 * 2 / 3 : g28 / 2

  const g29 = g26 + g27 - g28
  const m29 = m26 + m27 - m28
  const g30 = g29 * (1 + TAX_RATE)
  const m30 = m29 * (1 + TAX_RATE)

  const enrollmentFee = (campaign === '入塾金無料' || campaign === '講習キャンペーン' || campaign === '入塾金支払い済み') ? 0 : ENROLLMENT_FEE
  const firstTuition = g30
  const firstTotal = enrollmentFee + firstTuition

  const 翌月末 = calcEndOfNextMonth(startYear, startMonth)
  const 翌月初 = new Date(翌月末.getTime() + 86400000)

  // テーブル行
  const initial_rows: TuitionRow[] = [
    { label: `${course1}（${month1}月）`, grade, duration: '80分', frequency: `週${course1Lessons}回`, amount: g22 },
    { label: `${course1}（${month2}月）`, grade, duration: '80分', frequency: `週${course1Lessons}回`, amount: g23 },
  ]
  if (hasCourse2) {
    initial_rows.push(
      { label: `${course2}（${month1}月）`, grade, duration: '80分', frequency: `週${course2Lessons}回`, amount: g24 },
      { label: `${course2}（${month2}月）`, grade, duration: '80分', frequency: `週${course2Lessons}回`, amount: g25 },
    )
  }

  const regular_rows: TuitionRow[] = [
    { label: course1, grade, duration: '80分', frequency: `週${course1Lessons}回`, amount: m22 },
  ]
  if (hasCourse2) {
    regular_rows.push(
      { label: course2, grade, duration: '80分', frequency: `週${course2Lessons}回`, amount: m23 },
    )
  }

  return {
    入塾日: formatDate(sd), 退塾日: formatDate(ed),
    翌月末: formatDate(翌月末), 翌月初: formatDate(翌月初),
    初回月謝ラベル: `初回月謝（${month1}月分／${month2}月分）`,
    month1, month2,
    initial_rows, g26, equip_desc: equipDesc, g27, g28, g29, g30,
    regular_rows, m26, m27, m28, m29, m30,
    enrollment_fee: enrollmentFee, first_tuition: firstTuition, first_total: firstTotal,
    regular_monthly: m30,
  }
}

// 継続契約書用
export interface TuitionBlock {
  rows: TuitionRow[]
  tuition_total: number
  facility: number
  discount: number
  total_ex_tax: number
  total_inc_tax: number
}

export interface KeizokuCalcResult {
  前契約開始日: string
  前契約終了日: string
  継続日: string
  退塾日: string
  before: TuitionBlock
  before_period: string
  after: TuitionBlock
  after_period: string
  regular_monthly: number
  transfer_date: string
  grade_before: string
  grade_after: string
}

function calcTuitionBlock(grade: string, courses: { course: string; lessons: number }[]): TuitionBlock {
  const rows: TuitionRow[] = []
  let tuitionTotal = 0

  for (const { course, lessons } of courses) {
    if (!course || lessons <= 0) continue
    const unit = getPrice(course, grade)
    const amount = unit * lessons
    tuitionTotal += amount
    rows.push({ label: course, grade, duration: '80分', frequency: `週${lessons}回`, amount })
  }

  const facility = FACILITY_FEE_MONTHLY
  let discount = 0
  for (const { course, lessons } of courses) {
    if (course && lessons > 0) discount += getDiscount(lessons)
  }

  const totalExTax = tuitionTotal + facility - discount
  const totalIncTax = totalExTax * (1 + TAX_RATE)

  return { rows, tuition_total: tuitionTotal, facility, discount, total_ex_tax: totalExTax, total_inc_tax: totalIncTax }
}

export function calculateKeizoku(
  gradeBefore: string,
  gradeAfter: string,
  prevStartDate: string,
  startDate: string, // 継続日
  endDate: string,
  beforeCourses: { course: string; lessons: number }[],
  afterCourses: { course: string; lessons: number }[],
): KeizokuCalcResult {
  const prevStart = new Date(prevStartDate + 'T00:00:00')
  const keizokuDate = new Date(startDate + 'T00:00:00')
  const endD = new Date(endDate + 'T00:00:00')
  const prevEnd = new Date(keizokuDate.getTime() - 86400000)

  const before = calcTuitionBlock(gradeBefore, beforeCourses)
  const after = calcTuitionBlock(gradeAfter, afterCourses)

  const startMonth = keizokuDate.getMonth() + 1
  let transferMonth = startMonth - 1
  let transferYear = keizokuDate.getFullYear()
  if (transferMonth < 1) { transferMonth = 12; transferYear -= 1 }

  return {
    前契約開始日: formatDate(prevStart),
    前契約終了日: formatDate(prevEnd),
    継続日: formatDate(keizokuDate),
    退塾日: formatDate(endD),
    before,
    before_period: `${formatDate(prevStart)} ～ ${formatDate(prevEnd)}`,
    after,
    after_period: `${formatDate(keizokuDate)} ～ ${formatDate(endD)}`,
    regular_monthly: after.total_inc_tax,
    transfer_date: `${transferYear}年${transferMonth}月27日`,
    grade_before: gradeBefore,
    grade_after: gradeAfter,
  }
}

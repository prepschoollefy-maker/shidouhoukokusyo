/**
 * 料金定数・計算ロジック（pricing.py の TypeScript 移植）
 */

export const GRADES = ['小3', '小4', '小5', '小6', '中1', '中2', '中3', '高1', '高2', '高3'] as const
export type Grade = (typeof GRADES)[number]

export const COURSES = ['ハイ', 'ハイPLUS', 'エク', 'エグゼ'] as const
export type CourseName = (typeof COURSES)[number]

export const GRADE_CATEGORY_MAP: Record<Grade, string> = {
  '小3': '小3-小5',
  '小4': '小3-小5',
  '小5': '小3-小5',
  '小6': '小6',
  '中1': '中1/2',
  '中2': '中1/2',
  '中3': '中3/高1',
  '高1': '中3/高1',
  '高2': '高2/高3',
  '高3': '高2/高3',
}

/** コース×学年区分 → 税抜単価（1コマ/週あたり月額） */
export const COURSE_PRICES: Record<string, number> = {
  'ハイ_小3-小5': 35000,
  'ハイ_小6': 40000,
  'ハイ_中1/2': 37000,
  'ハイ_中3/高1': 38000,
  'ハイ_高2/高3': 40000,
  'ハイPLUS_小6': 44000,
  'ハイPLUS_中3/高1': 45000,
  'ハイPLUS_高2/高3': 47000,
  'エク_小3-小5': 47000,
  'エク_小6': 52000,
  'エク_中1/2': 49000,
  'エク_中3/高1': 50000,
  'エク_高2/高3': 52000,
  'エグゼ_小3-小5': 65000,
  'エグゼ_小6': 70000,
  'エグゼ_中1/2': 67000,
  'エグゼ_中3/高1': 68000,
  'エグゼ_高2/高3': 70000,
}

/** 複数コマ受講割引（税抜/月） */
export const LESSON_DISCOUNT: Record<number, number> = {
  2: 5000,
  3: 10000,
  4: 15000,
  5: 20000,
  6: 25000,
  7: 30000,
}

/** 設備利用料（税込/月） */
export const FACILITY_FEE_MONTHLY_TAX_INCL = 3300
/** 設備利用料（税込/月・半月） */
export const FACILITY_FEE_HALF_TAX_INCL = 1650

/** 講習キャンペーン割引（税込額）— ハイコースのみ対応 */
export const CAMPAIGN_DISCOUNT_TAX_INCL: Record<string, number> = {
  'ハイ_小3-小5': 10500,
  'ハイ_小6': 12000,
  'ハイ_中1/2': 11100,
  'ハイ_中3/高1': 11400,
  'ハイ_高2/高3': 12000,
}

/** キャンペーンの選択肢 */
export const CAMPAIGN_OPTIONS = [
  { value: '', label: 'なし' },
  { value: '入塾金支払い済み', label: '入塾金支払い済み' },
  { value: '入塾金無料', label: '入塾金無料' },
  { value: '入塾金半額', label: '入塾金半額' },
  { value: '講習キャンペーン', label: '講習キャンペーン' },
] as const

/** 消費税率 */
export const TAX_RATE = 0.10

export interface CourseEntry {
  course: string
  lessons: number
}

/**
 * 学年+コース配列 → 授業料（税込整数、設備利用料は含まない）
 */
export function calcMonthlyAmount(grade: string, courses: CourseEntry[]): number {
  const category = GRADE_CATEGORY_MAP[grade as Grade]
  if (!category) return 0

  let tuitionTotal = 0
  let discountTotal = 0

  for (const { course, lessons } of courses) {
    if (!course || lessons <= 0) continue
    const price = COURSE_PRICES[`${course}_${category}`]
    if (price == null) continue
    tuitionTotal += price * lessons
    discountTotal += LESSON_DISCOUNT[lessons] ?? 0
  }

  if (tuitionTotal === 0) return 0

  const totalExTax = tuitionTotal - discountTotal
  return Math.floor(totalExTax * (1 + TAX_RATE))
}

/**
 * キャンペーン選択 → 入塾金を自動決定
 */
export function getEnrollmentFeeForCampaign(campaign: string): number {
  switch (campaign) {
    case '入塾金支払い済み': return 0
    case '入塾金無料': return 0
    case '入塾金半額': return 16500
    case '講習キャンペーン': return 0
    default: return 33000
  }
}

/**
 * 講習キャンペーン割引額（税込）を計算。
 * コース1（最初のコース）×学年区分で割引額を決定。
 * Flask版: (tax_incl / 1.1) * 2 → 税抜×2 を初回月謝から差し引き → 税込に戻す
 * 月次モデルでは初月のみ適用するため、税込額をそのまま使用。
 */
export function calcCampaignDiscount(grade: string, courses: CourseEntry[]): number {
  if (courses.length === 0) return 0
  const category = GRADE_CATEGORY_MAP[grade as Grade]
  if (!category) return 0
  const firstCourse = courses[0].course
  return CAMPAIGN_DISCOUNT_TAX_INCL[`${firstCourse}_${category}`] ?? 0
}

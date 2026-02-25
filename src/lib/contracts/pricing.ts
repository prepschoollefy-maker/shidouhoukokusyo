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

/** 設備利用料（税抜/月） */
export const FACILITY_FEE_MONTHLY = 3000

/** 消費税率 */
export const TAX_RATE = 0.10

export interface CourseEntry {
  course: string
  lessons: number
}

/**
 * 学年+コース配列 → 月謝（税込整数）
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

  const totalExTax = tuitionTotal + FACILITY_FEE_MONTHLY - discountTotal
  return Math.floor(totalExTax * (1 + TAX_RATE))
}

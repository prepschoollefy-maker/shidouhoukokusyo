/**
 * 講習（スポット受講）料金定数・計算ロジック
 *
 * 計算式: (学年別基本単価 + コース加算) × 受講コマ数（全額税込）
 */

import { GRADE_CATEGORY_MAP, type Grade } from '@/lib/contracts/pricing'

export const LECTURE_LABELS = ['春期', '夏期', '冬期', '受験直前特訓', 'その他'] as const
export type LectureLabel = (typeof LECTURE_LABELS)[number]

export const LECTURE_COURSES = ['ハイスタンダード', 'エクセレンス', 'エグゼクティブ'] as const
export type LectureCourseName = (typeof LECTURE_COURSES)[number]

/** 学年区分 → 基本単価（税込） */
export const LECTURE_BASE_PRICES: Record<string, number> = {
  '小3-小5': 10500,
  '小6': 12000,
  '中1/2': 11100,
  '中3/高1': 11400,
  '高2/高3': 12000,
}

/** コース → 加算額（税込） */
export const LECTURE_COURSE_SURCHARGES: Record<string, number> = {
  'ハイスタンダード': 0,
  'エクセレンス': 3300,
  'エグゼクティブ': 8250,
}

export interface LectureAllocation {
  year: number
  month: number
  lessons: number
}

export interface LectureCourseEntry {
  course: string
  total_lessons: number
  unit_price: number
  subtotal: number
  allocation: LectureAllocation[]
}

/**
 * 1コマ単価を計算（税込）
 */
export function calcLectureUnitPrice(grade: string, course: string): number {
  const category = GRADE_CATEGORY_MAP[grade as Grade]
  if (!category) return 0
  const base = LECTURE_BASE_PRICES[category]
  if (base == null) return 0
  const surcharge = LECTURE_COURSE_SURCHARGES[course]
  if (surcharge == null) return 0
  return base + surcharge
}

/**
 * コース配列から合計金額を計算
 */
export function calcLectureTotalAmount(grade: string, courses: LectureCourseEntry[]): number {
  let total = 0
  for (const c of courses) {
    const unitPrice = calcLectureUnitPrice(grade, c.course)
    total += unitPrice * c.total_lessons
  }
  return total
}

/**
 * サーバー側でコースの unit_price / subtotal を再計算（フロント値を信用しない）
 */
export function normalizeLectureCourses(grade: string, courses: LectureCourseEntry[]): LectureCourseEntry[] {
  return courses.map(c => {
    const unitPrice = calcLectureUnitPrice(grade, c.course)
    return {
      ...c,
      unit_price: unitPrice,
      subtotal: unitPrice * c.total_lessons,
    }
  })
}

/**
 * allocation の lessons 合計が total_lessons と一致するか検証
 */
export function validateAllocation(courses: LectureCourseEntry[]): string | null {
  for (const c of courses) {
    const allocSum = (c.allocation || []).reduce((sum, a) => sum + a.lessons, 0)
    if (allocSum !== c.total_lessons) {
      return `${c.course}: 月別配分の合計(${allocSum})がコマ数(${c.total_lessons})と一致しません`
    }
  }
  return null
}

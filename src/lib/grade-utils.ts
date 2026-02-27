/** 学年のソート順・表示色・グルーピングユーティリティ */

const GRADE_ORDER: Record<string, number> = {
  '小1': 1, '小2': 2, '小3': 3, '小4': 4, '小5': 5, '小6': 6,
  '中1': 7, '中2': 8, '中3': 9,
  '高1': 10, '高2': 11, '高3': 12,
  '浪人': 13,
}

export function gradeSort(a: string | null, b: string | null): number {
  const orderA = a ? (GRADE_ORDER[a] ?? 99) : 100
  const orderB = b ? (GRADE_ORDER[b] ?? 99) : 100
  return orderA - orderB
}

export function getGradeCategory(grade: string | null): string {
  if (!grade) return 'other'
  if (grade.startsWith('小')) return 'elementary'
  if (grade.startsWith('中')) return 'middle'
  if (grade.startsWith('高') || grade === '浪人') return 'high'
  return 'other'
}

export function getGradeCategoryLabel(category: string): string {
  switch (category) {
    case 'elementary': return '小学生'
    case 'middle': return '中学生'
    case 'high': return '高校生'
    default: return 'その他'
  }
}

/** 学年バッジ用: コンパクトなピル型 */
export function getGradeColor(grade: string | null): string {
  const cat = getGradeCategory(grade)
  switch (cat) {
    case 'elementary': return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    case 'middle': return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
    case 'high': return 'bg-violet-50 text-violet-700 ring-1 ring-violet-200'
    default: return 'bg-gray-50 text-gray-600 ring-1 ring-gray-200'
  }
}

/** セクション左ボーダー色 */
export function getGradeSectionBorder(category: string): string {
  switch (category) {
    case 'elementary': return 'border-l-emerald-400'
    case 'middle': return 'border-l-sky-400'
    case 'high': return 'border-l-violet-400'
    default: return 'border-l-gray-300'
  }
}

/** セクションラベル色 */
export function getGradeSectionLabel(category: string): string {
  switch (category) {
    case 'elementary': return 'text-emerald-600'
    case 'middle': return 'text-sky-600'
    case 'high': return 'text-violet-600'
    default: return 'text-gray-500'
  }
}

/** セクションドット色 */
export function getGradeDot(category: string): string {
  switch (category) {
    case 'elementary': return 'bg-emerald-400'
    case 'middle': return 'bg-sky-400'
    case 'high': return 'bg-violet-400'
    default: return 'bg-gray-300'
  }
}

/** アイテムの配列を学年カテゴリでグルーピング */
export function groupByGrade<T>(items: T[], getGrade: (item: T) => string | null): { category: string; label: string; items: T[] }[] {
  const categoryOrder = ['elementary', 'middle', 'high', 'other']
  const groups: Record<string, T[]> = {}

  const sorted = [...items].sort((a, b) => gradeSort(getGrade(a), getGrade(b)))

  for (const item of sorted) {
    const cat = getGradeCategory(getGrade(item))
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  }

  return categoryOrder
    .filter(cat => groups[cat]?.length)
    .map(cat => ({
      category: cat,
      label: getGradeCategoryLabel(cat),
      items: groups[cat],
    }))
}

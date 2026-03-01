import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyContractPassword } from '@/lib/contracts/auth'
import { GRADE_NEXT } from '@/lib/contracts/pricing'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  // 年度ロジック: 4月始まり
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const fy = month >= 4 ? year : year - 1

  const endFrom = request.nextUrl.searchParams.get('end_from') || `${fy + 1}-01-31`
  const endTo = request.nextUrl.searchParams.get('end_to') || `${fy + 1}-03-31`

  const { data, error } = await supabase
    .from('contracts')
    .select('*, student:students(id, name, student_number)')
    .gte('end_date', endFrom)
    .lte('end_date', endTo)
    .order('end_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 各契約にデフォルト更新値を算出
  const items = (data || []).map((c) => {
    const courses = (c.courses as { name?: string; course?: string; lessons: number }[] || []).map((entry) => ({
      course: entry.course || entry.name || '',
      lessons: entry.lessons,
    }))

    // 受験生判定: end_dateが1/31
    const isExam = c.end_date.endsWith('-01-31')
    const endYear = parseInt(c.end_date.slice(0, 4))

    let newGrade: string
    let newStartDate: string
    let newEndDate: string

    if (isExam) {
      // 受験生: 学年据え置き、2/1〜3/31
      newGrade = c.grade
      newStartDate = `${endYear}-02-01`
      newEndDate = `${endYear}-03-31`
    } else {
      // 通常: 進級、4/1〜翌3/31
      newGrade = GRADE_NEXT[c.grade] || c.grade
      newStartDate = `${endYear + (c.end_date.endsWith('-03-31') ? 0 : 1)}-04-01`
      newEndDate = `${endYear + (c.end_date.endsWith('-03-31') ? 1 : 2)}-03-31`
    }

    return {
      ...c,
      courses,
      defaults: {
        new_grade: newGrade,
        new_courses: courses,
        new_start_date: newStartDate,
        new_end_date: newEndDate,
      },
    }
  })

  return NextResponse.json({ data: items })
}

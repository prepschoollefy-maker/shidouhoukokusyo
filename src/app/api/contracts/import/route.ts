import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcMonthlyAmount } from '@/lib/contracts/pricing'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows } = await request.json()
  if (!rows?.length) {
    return NextResponse.json({ error: 'データがありません' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 塾生番号 → student_id のマッピングを事前取得
  const { data: students } = await admin
    .from('students')
    .select('id, student_number, name')

  const studentMap = new Map<string, string>()
  for (const s of students || []) {
    if (s.student_number) studentMap.set(s.student_number, s.id)
  }

  let count = 0
  const errors: string[] = []

  for (const row of rows) {
    const studentNumber = row['塾生番号'] || row['student_number']
    if (!studentNumber) {
      errors.push('塾生番号が空の行をスキップしました')
      continue
    }

    const studentId = studentMap.get(String(studentNumber))
    if (!studentId) {
      errors.push(`塾生番号 ${studentNumber} の生徒が見つかりません`)
      continue
    }

    const grade = row['学年'] || row['grade']
    const startDate = row['開始日'] || row['start_date']
    const endDate = row['終了日'] || row['end_date']
    if (!grade || !startDate || !endDate) {
      errors.push(`塾生番号 ${studentNumber}: 必須項目（学年/開始日/終了日）が不足`)
      continue
    }

    // コース解析: "コース1名,コマ数;コース2名,コマ数" 形式
    const coursesStr = row['コース'] || row['courses'] || ''
    const courses: { course: string; lessons: number }[] = []
    if (coursesStr) {
      for (const part of coursesStr.split(';')) {
        const [name, lessons] = part.split(',').map((s: string) => s.trim())
        if (name && lessons) {
          courses.push({ course: name, lessons: parseInt(lessons) || 1 })
        }
      }
    }

    const monthlyAmount = calcMonthlyAmount(grade, courses)

    const { error } = await admin
      .from('contracts')
      .insert({
        student_id: studentId,
        type: row['種別'] === '継続' ? 'renewal' : 'initial',
        start_date: startDate,
        end_date: endDate,
        grade,
        courses,
        monthly_amount: monthlyAmount,
        staff_name: row['担当'] || row['staff_name'] || '',
        notes: row['備考'] || row['notes'] || '',
      })

    if (error) {
      errors.push(`塾生番号 ${studentNumber}: ${error.message}`)
      continue
    }
    count++
  }

  return NextResponse.json({ count, errors: errors.length ? errors : undefined })
}

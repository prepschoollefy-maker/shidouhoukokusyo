import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { eachDayOfInterval, getDay, parseISO } from 'date-fns'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { start_date, end_date } = body

  if (!start_date || !end_date) {
    return NextResponse.json({ error: '開始日と終了日を指定してください' }, { status: 400 })
  }

  // activeなテンプレートを取得
  const { data: templates, error: templateError } = await supabase
    .from('regular_lesson_templates')
    .select('*')
    .eq('is_active', true)

  if (templateError) return NextResponse.json({ error: templateError.message }, { status: 500 })
  if (!templates || templates.length === 0) {
    return NextResponse.json({ error: '有効なテンプレートがありません' }, { status: 400 })
  }

  // 日付範囲内の全日を生成
  const days = eachDayOfInterval({
    start: parseISO(start_date),
    end: parseISO(end_date),
  })

  // テンプレートを曜日別にグルーピング
  const templatesByDay: Record<number, typeof templates> = {}
  for (const t of templates) {
    if (!templatesByDay[t.day_of_week]) templatesByDay[t.day_of_week] = []
    templatesByDay[t.day_of_week].push(t)
  }

  // 授業レコードを生成
  const lessonsToInsert: {
    student_id: string
    teacher_id: string
    subject_id: string | null
    lesson_date: string
    time_slot_id: string
    booth_id: string | null
    lesson_type: string
    template_id: string
    notes: string
  }[] = []

  for (const day of days) {
    const dow = getDay(day) // 0=Sun, 1=Mon, ..., 6=Sat
    const dayTemplates = templatesByDay[dow]
    if (!dayTemplates) continue

    const dateStr = day.toISOString().slice(0, 10)
    for (const t of dayTemplates) {
      lessonsToInsert.push({
        student_id: t.student_id,
        teacher_id: t.teacher_id,
        subject_id: t.subject_id,
        lesson_date: dateStr,
        time_slot_id: t.time_slot_id,
        booth_id: t.booth_id,
        lesson_type: 'regular',
        template_id: t.id,
        notes: t.notes || '',
      })
    }
  }

  if (lessonsToInsert.length === 0) {
    return NextResponse.json({ message: '生成対象の授業がありません', created: 0 })
  }

  // 一括挿入（重複はスキップ）
  // Supabase doesn't support ON CONFLICT DO NOTHING directly,
  // so we insert one by one and skip duplicates
  let created = 0
  let skipped = 0

  for (const lesson of lessonsToInsert) {
    const { error } = await supabase
      .from('lessons')
      .insert(lesson)

    if (error) {
      if (error.code === '23505') {
        skipped++
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      created++
    }
  }

  return NextResponse.json({
    message: `${created}件の授業を生成しました${skipped > 0 ? `（${skipped}件は既存のためスキップ）` : ''}`,
    created,
    skipped,
  })
}

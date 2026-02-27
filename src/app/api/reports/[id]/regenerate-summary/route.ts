import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateLessonSummary } from '@/lib/claude/summary'
import { getAiPromptSettings } from '@/lib/settings'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: fullReport, error } = await admin
    .from('lesson_reports')
    .select(`
      *,
      student:students(id, name, grade),
      subject:subjects(id, name),
      teacher:profiles(id, display_name),
      report_textbooks(id, textbook_name, pages, sort_order),
      report_attitudes(id, attitude_option_id, attitude_option:attitude_options(id, label, category))
    `)
    .eq('id', id)
    .single()

  if (error || !fullReport) {
    return NextResponse.json({ error: 'レポートが見つかりません' }, { status: 404 })
  }

  try {
    const { ai_lesson_prompt } = await getAiPromptSettings()
    const summary = await generateLessonSummary(
      fullReport,
      fullReport.student.name,
      fullReport.student.grade,
      ai_lesson_prompt
    )

    await admin
      .from('lesson_reports')
      .update({ ai_summary: summary })
      .eq('id', id)

    return NextResponse.json({ ai_summary: summary })
  } catch (e) {
    console.error('AI summary regeneration failed:', e)
    return NextResponse.json(
      { error: 'AI要約の生成に失敗しました' },
      { status: 500 }
    )
  }
}

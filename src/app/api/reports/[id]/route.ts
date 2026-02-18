import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('lesson_reports')
    .select(`
      *,
      student:students!inner(id, name, grade),
      subject:subjects!inner(id, name),
      teacher:profiles!inner(id, display_name),
      report_textbooks(id, textbook_name, pages, sort_order),
      report_attitudes(id, attitude_option_id, attitude_option:attitude_options(id, label, category))
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    student_id, lesson_date, subject_id, unit_covered,
    homework_check, free_comment, homework_assigned,
    next_lesson_plan, internal_notes, textbooks, positive_attitudes, negative_attitudes
  } = body

  const { data: report, error } = await supabase
    .from('lesson_reports')
    .update({
      student_id, lesson_date, subject_id, unit_covered,
      homework_check,
      free_comment: free_comment || null,
      homework_assigned,
      next_lesson_plan: next_lesson_plan || null,
      internal_notes: internal_notes || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Replace textbooks
  await supabase.from('report_textbooks').delete().eq('report_id', id)
  if (textbooks?.length) {
    const textbookRows = textbooks.map((t: { textbook_name: string; pages: string }, i: number) => ({
      report_id: id,
      textbook_name: t.textbook_name,
      pages: t.pages || null,
      sort_order: i,
    }))
    await supabase.from('report_textbooks').insert(textbookRows)
  }

  // Replace attitudes
  await supabase.from('report_attitudes').delete().eq('report_id', id)
  const allAttitudes = [...(positive_attitudes || []), ...(negative_attitudes || [])]
  if (allAttitudes.length) {
    const attitudeRows = allAttitudes.map((attId: string) => ({
      report_id: id,
      attitude_option_id: attId,
    }))
    await supabase.from('report_attitudes').insert(attitudeRows)
  }

  return NextResponse.json({ data: report })
}

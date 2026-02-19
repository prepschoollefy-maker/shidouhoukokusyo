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
    homework_check, strengths, weaknesses, free_comment, homework_assigned,
    next_lesson_plan, internal_notes, textbooks, positive_attitudes, negative_attitudes
  } = body

  const { data: report, error } = await supabase
    .from('lesson_reports')
    .update({
      student_id, lesson_date, subject_id, unit_covered,
      homework_check,
      strengths: strengths || null,
      weaknesses: weaknesses || null,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Delete related data first
  await supabase.from('report_textbooks').delete().eq('report_id', id)
  await supabase.from('report_attitudes').delete().eq('report_id', id)

  const { error } = await supabase
    .from('lesson_reports')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { success: true } })
}

// PATCH: partial update (e.g., ai_summary only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if ('ai_summary' in body) updates.ai_summary = body.ai_summary || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('lesson_reports')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

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
    .from('summaries')
    .select(`
      *,
      student:students!inner(id, name, grade),
      subject:subjects(id, name),
      summary_reports(
        id,
        report:lesson_reports(
          *,
          student:students(id, name, grade),
          subject:subjects(id, name),
          teacher:profiles(id, display_name),
          report_textbooks(id, textbook_name, pages, sort_order),
          report_attitudes(id, attitude_option_id, attitude_option:attitude_options(id, label, category))
        )
      )
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
  const { status, content } = body

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (content !== undefined) updates.content = content

  if (status === 'approved') {
    // Check if auto_send should be set
    const { data: summary } = await supabase.from('summaries').select('student_id').eq('id', id).single()
    if (summary) {
      const { data: student } = await supabase.from('students').select('send_mode').eq('id', summary.student_id).single()
      if (student?.send_mode === 'auto_send') {
        const { data: settings } = await supabase.from('school_settings').select('auto_send_wait_hours').limit(1).single()
        const waitHours = settings?.auto_send_wait_hours || 24
        updates.auto_send_at = new Date(Date.now() + waitHours * 60 * 60 * 1000).toISOString()
      }
    }
  }

  const { data, error } = await supabase
    .from('summaries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

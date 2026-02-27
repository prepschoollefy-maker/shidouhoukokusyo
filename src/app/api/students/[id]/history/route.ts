import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const admin = createAdminClient()

  // Fetch student info
  const { data: student, error: studentError } = await admin
    .from('students')
    .select(`
      id, name, grade,
      student_subjects(id, subject_id, subject:subjects(id, name))
    `)
    .eq('id', id)
    .single()

  if (studentError) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  // Fetch reports with pagination
  const { data: reports, count, error: reportsError } = await admin
    .from('lesson_reports')
    .select(`
      id, lesson_date, unit_covered, homework_check, homework_assigned,
      next_lesson_plan, internal_notes, strengths, weaknesses, free_comment,
      subject:subjects(id, name),
      teacher:profiles(id, display_name),
      report_textbooks(id, textbook_name, pages, sort_order),
      report_attitudes(id, attitude_option_id, attitude_option:attitude_options(id, label, category))
    `, { count: 'exact' })
    .eq('student_id', id)
    .order('lesson_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (reportsError) return NextResponse.json({ error: reportsError.message }, { status: 500 })

  return NextResponse.json({ student, reports, count, page, limit })
}

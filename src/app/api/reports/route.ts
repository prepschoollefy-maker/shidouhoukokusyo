import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('student_id')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  let query = supabase
    .from('lesson_reports')
    .select(`
      *,
      student:students!inner(id, name, grade),
      subject:subjects!inner(id, name),
      teacher:profiles!inner(id, display_name),
      report_textbooks(id, textbook_name, pages, sort_order),
      report_attitudes(id, attitude_option_id, attitude_option:attitude_options(id, label, category))
    `, { count: 'exact' })
    .order('lesson_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (studentId) {
    query = query.eq('student_id', studentId)
  }

  // RLSが講師のアクセス制御を行う（自分のレポート + 担当生徒のレポート）
  // 管理者はRLSでフルアクセス

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, page, limit })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    student_id, lesson_date, subject_id, unit_covered,
    homework_check, free_comment, homework_assigned,
    next_lesson_plan, internal_notes, textbooks, positive_attitudes, negative_attitudes
  } = body

  // Insert report
  const { data: report, error: reportError } = await supabase
    .from('lesson_reports')
    .insert({
      teacher_id: user.id,
      student_id,
      lesson_date,
      subject_id,
      unit_covered,
      homework_check,
      free_comment: free_comment || null,
      homework_assigned,
      next_lesson_plan: next_lesson_plan || null,
      internal_notes: internal_notes || null,
    })
    .select()
    .single()

  if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 })

  // Insert textbooks
  if (textbooks?.length) {
    const textbookRows = textbooks.map((t: { textbook_name: string; pages: string }, i: number) => ({
      report_id: report.id,
      textbook_name: t.textbook_name,
      pages: t.pages || null,
      sort_order: i,
    }))
    await supabase.from('report_textbooks').insert(textbookRows)
  }

  // Insert attitudes
  const allAttitudes = [...(positive_attitudes || []), ...(negative_attitudes || [])]
  if (allAttitudes.length) {
    const attitudeRows = allAttitudes.map((id: string) => ({
      report_id: report.id,
      attitude_option_id: id,
    }))
    await supabase.from('report_attitudes').insert(attitudeRows)
  }

  // Check summary threshold
  const { data: student } = await supabase
    .from('students')
    .select('summary_frequency, send_mode')
    .eq('id', student_id)
    .single()

  if (student) {
    // Count unsummarized reports for this student
    const { count: unsummarizedCount } = await supabase
      .from('lesson_reports')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', student_id)
      .not('id', 'in', `(SELECT report_id FROM summary_reports)`)

    // Note: threshold check - we'll trigger summary generation via the summaries API
    if (unsummarizedCount && unsummarizedCount >= student.summary_frequency) {
      // Trigger summary generation asynchronously
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      fetch(`${appUrl}/api/summaries/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id }),
      }).catch(() => {}) // fire-and-forget
    }
  }

  return NextResponse.json({ data: report }, { status: 201 })
}

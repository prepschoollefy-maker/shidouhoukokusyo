import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSummary } from '@/lib/claude/summary'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Allow both authenticated admin users and internal calls
  const body = await request.json()
  const { student_id } = body

  if (!student_id) {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get student info
  const { data: student } = await admin
    .from('students')
    .select('id, name, grade, summary_frequency, send_mode')
    .eq('id', student_id)
    .single()

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  // Get unsummarized reports
  const { data: allReports } = await admin
    .from('lesson_reports')
    .select(`
      *,
      student:students!inner(id, name, grade),
      subject:subjects!inner(id, name),
      teacher:profiles!inner(id, display_name),
      report_textbooks(id, textbook_name, pages, sort_order),
      report_attitudes(id, attitude_option_id, attitude_option:attitude_options(id, label, category))
    `)
    .eq('student_id', student_id)
    .order('lesson_date', { ascending: true })

  if (!allReports?.length) {
    return NextResponse.json({ error: 'No reports found' }, { status: 404 })
  }

  // Find reports not yet in any summary
  const { data: summarizedReportIds } = await admin
    .from('summary_reports')
    .select('report_id')

  const summarizedIds = new Set(summarizedReportIds?.map(sr => sr.report_id) || [])
  const unsummarized = allReports.filter(r => !summarizedIds.has(r.id))

  if (unsummarized.length < student.summary_frequency) {
    return NextResponse.json({ error: 'Not enough reports for summary' }, { status: 400 })
  }

  // Take the oldest N reports
  const reportsForSummary = unsummarized.slice(0, student.summary_frequency)

  try {
    const content = await generateSummary(reportsForSummary, student.name, student.grade)

    const periodStart = reportsForSummary[0].lesson_date
    const periodEnd = reportsForSummary[reportsForSummary.length - 1].lesson_date

    // Create summary
    const { data: summary, error: summaryError } = await admin
      .from('summaries')
      .insert({
        student_id,
        subject_id: null,
        status: 'unchecked',
        content,
        period_start: periodStart,
        period_end: periodEnd,
      })
      .select()
      .single()

    if (summaryError) throw summaryError

    // Link reports to summary
    const linkRows = reportsForSummary.map(r => ({
      summary_id: summary.id,
      report_id: r.id,
    }))
    await admin.from('summary_reports').insert(linkRows)

    return NextResponse.json({ data: summary }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Summary generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

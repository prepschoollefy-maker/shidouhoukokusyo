import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateMonthlySummary } from '@/lib/claude/summary'
import { getAiPromptSettings } from '@/lib/settings'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  // List students who have reports in the specified date range
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // end_date is inclusive, so query < endDate + 1 day
  const endDateExclusive = new Date(endDate)
  endDateExclusive.setDate(endDateExclusive.getDate() + 1)
  const endDateStr = endDateExclusive.toISOString().split('T')[0]

  const { data: reports } = await admin
    .from('lesson_reports')
    .select('student_id, student:students!inner(id, name)')
    .gte('lesson_date', startDate)
    .lt('lesson_date', endDateStr)

  if (!reports?.length) {
    return NextResponse.json({ error: `${startDate}〜${endDate}のレポートがありません` }, { status: 404 })
  }

  // Deduplicate students and count reports
  const studentMap = new Map<string, { id: string; name: string; report_count: number }>()
  for (const r of reports) {
    const s = r.student as unknown as { id: string; name: string }
    const existing = studentMap.get(s.id)
    if (existing) {
      existing.report_count++
    } else {
      studentMap.set(s.id, { id: s.id, name: s.name, report_count: 1 })
    }
  }

  return NextResponse.json({ students: Array.from(studentMap.values()) })
}

export async function POST(request: NextRequest) {
  // Generate summary for a single student
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { start_date, end_date, student_id } = body

  if (!start_date || !end_date || !student_id) {
    return NextResponse.json({ error: 'start_date, end_date, and student_id are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // end_date is inclusive
  const endDateExclusive = new Date(end_date)
  endDateExclusive.setDate(endDateExclusive.getDate() + 1)
  const endDateStr = endDateExclusive.toISOString().split('T')[0]

  const { data: student } = await admin
    .from('students')
    .select('id, name, grade')
    .eq('id', student_id)
    .single()

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  const { data: reports } = await admin
    .from('lesson_reports')
    .select(`
      *,
      student:students(id, name, grade),
      subject:subjects(id, name),
      teacher:profiles(id, display_name),
      report_textbooks(id, textbook_name, pages, sort_order),
      report_attitudes(id, attitude_option_id, attitude_option:attitude_options(id, label, category))
    `)
    .eq('student_id', student_id)
    .gte('lesson_date', start_date)
    .lt('lesson_date', endDateStr)
    .order('lesson_date', { ascending: true })

  if (!reports?.length) {
    return NextResponse.json({ error: 'No reports found for this student' }, { status: 404 })
  }

  try {
    // Build period label like "2/1〜2/19"
    const sd = new Date(start_date)
    const ed = new Date(end_date)
    const periodLabel = `${sd.getMonth() + 1}/${sd.getDate()}〜${ed.getMonth() + 1}/${ed.getDate()}`

    const { ai_monthly_prompt } = await getAiPromptSettings()
    const content = await generateMonthlySummary(reports, student.name, student.grade, periodLabel, ai_monthly_prompt)

    const periodStart = reports[0].lesson_date
    const periodEnd = reports[reports.length - 1].lesson_date
    const viewToken = crypto.randomUUID()

    const { data: summary, error: summaryError } = await admin
      .from('summaries')
      .insert({
        student_id,
        subject_id: null,
        status: 'unchecked',
        content,
        period_start: periodStart,
        period_end: periodEnd,
        view_token: viewToken,
      })
      .select()
      .single()

    if (summaryError) throw summaryError

    const linkRows = reports.map(r => ({
      summary_id: summary.id,
      report_id: r.id,
    }))
    await admin.from('summary_reports').insert(linkRows)

    return NextResponse.json({ data: { summary_id: summary.id, student_name: student.name } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Summary generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

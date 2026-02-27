import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateLessonSummary } from '@/lib/gemini/summary'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('student_id')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  // When searching by student name, first resolve matching student IDs
  // to avoid unreliable PostgREST embedded resource filtering
  let studentIdFilter: string[] | null = null
  if (search) {
    const admin = createAdminClient()
    const { data: matchedStudents } = await admin
      .from('students')
      .select('id')
      .ilike('name', `%${search}%`)
    studentIdFilter = matchedStudents?.map(s => s.id) || []
  }

  let query = supabase
    .from('lesson_reports')
    .select(`
      *,
      student:students(id, name, grade),
      subject:subjects(id, name),
      teacher:profiles(id, display_name),
      report_textbooks(id, textbook_name, pages, sort_order),
      report_attitudes(id, attitude_option_id, attitude_option:attitude_options(id, label, category))
    `, { count: 'exact' })
    .order('lesson_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (studentId) {
    query = query.eq('student_id', studentId)
  }

  if (studentIdFilter !== null) {
    if (studentIdFilter.length === 0) {
      return NextResponse.json({ data: [], count: 0, page, limit })
    }
    query = query.in('student_id', studentIdFilter)
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
    homework_check, strengths, weaknesses, free_comment, homework_assigned,
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
      strengths: strengths || null,
      weaknesses: weaknesses || null,
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

  // Generate per-lesson AI summary asynchronously
  const admin = createAdminClient()
  ;(async () => {
    try {
      const { data: fullReport } = await admin
        .from('lesson_reports')
        .select(`
          *,
          student:students(id, name, grade),
          subject:subjects(id, name),
          teacher:profiles(id, display_name),
          report_textbooks(id, textbook_name, pages, sort_order),
          report_attitudes(id, attitude_option_id, attitude_option:attitude_options(id, label, category))
        `)
        .eq('id', report.id)
        .single()

      if (!fullReport) return

      const summary = await generateLessonSummary(
        fullReport,
        fullReport.student.name,
        fullReport.student.grade
      )

      await admin
        .from('lesson_reports')
        .update({ ai_summary: summary })
        .eq('id', report.id)
    } catch (e) {
      console.error('Per-lesson AI summary generation failed:', e)
    }
  })()

  return NextResponse.json({ data: report }, { status: 201 })
}

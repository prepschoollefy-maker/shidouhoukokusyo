import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface GroupedStudent {
  student_id: string
  student_name: string
  grade: string | null
  subjects: string[]
  report_count: number
  latest_date: string
  latest_reports: {
    id: string
    lesson_date: string
    unit_covered: string
    subject_name: string
    teacher_name: string
  }[]
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const subjectId = searchParams.get('subject_id')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const isAdmin = user.app_metadata?.role === 'admin'

  // Use admin client for admin users, regular client (with RLS) for teachers
  const queryClient = isAdmin ? createAdminClient() : supabase

  // When searching by student name, resolve matching student IDs first
  let studentIdFilter: string[] | null = null
  if (search) {
    const admin = createAdminClient()
    const { data: matchedStudents } = await admin
      .from('students')
      .select('id')
      .ilike('name', `%${search}%`)
    studentIdFilter = matchedStudents?.map(s => s.id) || []
    if (studentIdFilter.length === 0) {
      return NextResponse.json({ data: [], count: 0, page, limit })
    }
  }

  // Build query - fetch all reports with necessary fields
  let query = queryClient
    .from('lesson_reports')
    .select(`
      id, lesson_date, unit_covered, student_id,
      student:students(id, name, grade),
      subject:subjects(id, name),
      teacher:profiles(id, display_name)
    `)
    .order('lesson_date', { ascending: false })

  if (studentIdFilter !== null) {
    query = query.in('student_id', studentIdFilter)
  }

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  const { data: reports, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!reports?.length) return NextResponse.json({ data: [], count: 0, page, limit })

  // Group by student
  const groupMap = new Map<string, GroupedStudent>()

  for (const r of reports) {
    const student = r.student as unknown as { id: string; name: string; grade: string | null }
    const subject = r.subject as unknown as { id: string; name: string }
    const teacher = r.teacher as unknown as { id: string; display_name: string }

    let group = groupMap.get(student.id)
    if (!group) {
      group = {
        student_id: student.id,
        student_name: student.name,
        grade: student.grade,
        subjects: [],
        report_count: 0,
        latest_date: r.lesson_date,
        latest_reports: [],
      }
      groupMap.set(student.id, group)
    }

    group.report_count++

    if (!group.subjects.includes(subject.name)) {
      group.subjects.push(subject.name)
    }

    if (group.latest_reports.length < 5) {
      group.latest_reports.push({
        id: r.id,
        lesson_date: r.lesson_date,
        unit_covered: r.unit_covered,
        subject_name: subject.name,
        teacher_name: teacher.display_name,
      })
    }
  }

  // Sort groups by latest_date desc
  const allGroups = Array.from(groupMap.values())
    .sort((a, b) => b.latest_date.localeCompare(a.latest_date))

  const totalCount = allGroups.length
  const offset = (page - 1) * limit
  const pagedGroups = allGroups.slice(offset, offset + limit)

  return NextResponse.json({ data: pagedGroups, count: totalCount, page, limit })
}

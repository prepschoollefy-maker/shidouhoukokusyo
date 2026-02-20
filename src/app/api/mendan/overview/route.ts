import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const statusParam = request.nextUrl.searchParams.get('status') || 'active'
  const admin = createAdminClient()

  // Fetch students
  let studentQuery = admin.from('students').select('id, name, status').order('name')
  if (statusParam !== 'all') {
    studentQuery = studentQuery.eq('status', statusParam)
  }
  const { data: students, error: studentsError } = await studentQuery
  if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 500 })
  if (!students?.length) return NextResponse.json({ data: [] })

  const studentIds = students.map(s => s.id)

  // Fetch all records for these students
  const { data: records } = await admin
    .from('mendan_records')
    .select('id, student_id, mendan_date, attendees, content')
    .in('student_id', studentIds)
    .order('mendan_date', { ascending: true })

  const overview = students.map(student => {
    const studentRecords = (records || []).filter(r => r.student_id === student.id)
    const recordCount = studentRecords.length
    const lastRecord = studentRecords.length > 0 ? studentRecords[studentRecords.length - 1] : null
    const lastMendanDate = lastRecord?.mendan_date || null

    return {
      student_id: student.id,
      student_name: student.name,
      student_status: student.status,
      record_count: recordCount,
      last_mendan_date: lastMendanDate,
      records: studentRecords.map(r => ({
        id: r.id,
        mendan_date: r.mendan_date,
        attendees: r.attendees,
        content: r.content,
      })),
    }
  })

  // Sort by name
  overview.sort((a, b) => a.student_name.localeCompare(b.student_name, 'ja'))

  return NextResponse.json({ data: overview })
}

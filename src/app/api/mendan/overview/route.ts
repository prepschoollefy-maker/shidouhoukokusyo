import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface OverviewRow {
  student_id: string
  student_name: string
  student_status: string
  record_count: number
  last_mendan_date: string | null
  next_due_date: string | null
  alert: 'overdue' | 'soon' | null
  records: {
    id: string
    mendan_date: string
    attendees: string | null
    content: string | null
  }[]
  requests: {
    id: string
    period_label: string
    candidate1: string
    candidate2: string
    candidate3: string
    message: string | null
    submitted_at: string
  }[]
}

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

  // Fetch all requests (via mendan_tokens -> mendan_requests)
  const { data: requests } = await admin
    .from('mendan_requests')
    .select('id, student_id, candidate1, candidate2, candidate3, candidate1_end, candidate2_end, candidate3_end, message, submitted_at, token:mendan_tokens!inner(period_label)')
    .in('student_id', studentIds)
    .order('submitted_at', { ascending: false })

  const now = new Date()
  const soonThreshold = 14 * 24 * 60 * 60 * 1000 // 14 days

  const overview: OverviewRow[] = students.map(student => {
    const studentRecords = (records || []).filter(r => r.student_id === student.id)
    const studentRequests = (requests || []).filter(r => r.student_id === student.id)

    const recordCount = studentRecords.length
    const lastRecord = studentRecords.length > 0 ? studentRecords[studentRecords.length - 1] : null
    const lastMendanDate = lastRecord?.mendan_date || null

    // Next due = last mendan + 90 days
    let nextDueDate: string | null = null
    if (lastMendanDate) {
      const d = new Date(lastMendanDate)
      d.setDate(d.getDate() + 90)
      nextDueDate = d.toISOString().split('T')[0]
    }

    // Alert logic (active students only)
    let alert: 'overdue' | 'soon' | null = null
    if (student.status === 'active') {
      if (!lastMendanDate) {
        // No records at all -> overdue
        alert = 'overdue'
      } else if (nextDueDate) {
        const dueTime = new Date(nextDueDate).getTime()
        if (dueTime <= now.getTime()) {
          alert = 'overdue'
        } else if (dueTime - now.getTime() <= soonThreshold) {
          alert = 'soon'
        }
      }
    }

    return {
      student_id: student.id,
      student_name: student.name,
      student_status: student.status,
      record_count: recordCount,
      last_mendan_date: lastMendanDate,
      next_due_date: nextDueDate,
      alert,
      records: studentRecords.map(r => ({
        id: r.id,
        mendan_date: r.mendan_date,
        attendees: r.attendees,
        content: r.content,
      })),
      requests: studentRequests.map(r => ({
        id: r.id,
        period_label: (r.token as unknown as { period_label: string }).period_label,
        candidate1: r.candidate1,
        candidate2: r.candidate2,
        candidate3: r.candidate3,
        candidate1_end: r.candidate1_end,
        candidate2_end: r.candidate2_end,
        candidate3_end: r.candidate3_end,
        message: r.message,
        submitted_at: r.submitted_at,
      })),
    }
  })

  // Sort: overdue first, then soon, then null, within each group by name
  overview.sort((a, b) => {
    const alertOrder = { overdue: 0, soon: 1 }
    const aOrder = a.alert ? alertOrder[a.alert] : 2
    const bOrder = b.alert ? alertOrder[b.alert] : 2
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.student_name.localeCompare(b.student_name, 'ja')
  })

  return NextResponse.json({ data: overview })
}

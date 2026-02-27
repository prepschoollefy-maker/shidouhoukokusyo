import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const studentId = searchParams.get('student_id')

  let query = supabase
    .from('summaries')
    .select(`
      *,
      student:students!inner(id, name, grade),
      subject:subjects(id, name),
      summary_reports(id)
    `)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (studentId) query = query.eq('student_id', studentId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = data?.map(s => ({
    ...s,
    report_count: s.summary_reports?.length || 0,
    summary_reports: undefined,
  }))

  return NextResponse.json({ data: result })
}

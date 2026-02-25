import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcMonthlyAmount, CourseEntry } from '@/lib/contracts/pricing'
import { verifyContractPassword } from '@/lib/contracts/auth'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const studentId = request.nextUrl.searchParams.get('student_id')
  const year = request.nextUrl.searchParams.get('year')
  const month = request.nextUrl.searchParams.get('month')

  let query = supabase
    .from('contracts')
    .select('*, student:students(id, name, student_number)')
    .order('start_date', { ascending: false })

  if (studentId) {
    query = query.eq('student_id', studentId)
  }

  if (year && month) {
    const y = parseInt(year)
    const m = parseInt(month)
    const firstDay = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).toISOString().split('T')[0]
    query = query.lte('start_date', lastDay).gte('end_date', firstDay)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const body = await request.json()
  const { student_id, type, start_date, end_date, grade, courses, staff_name, notes, campaign } = body

  if (!student_id || !start_date || !end_date || !grade || !courses?.length) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  const monthly_amount = calcMonthlyAmount(grade, courses as CourseEntry[])

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contracts')
    .insert({
      student_id,
      type: type || 'initial',
      start_date,
      end_date,
      grade,
      courses,
      monthly_amount,
      staff_name: staff_name || '',
      notes: notes || '',
      campaign: campaign || null,
    })
    .select('*, student:students(id, name, student_number)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyContractPassword } from '@/lib/contracts/auth'
import { normalizeLectureCourses, calcLectureTotalAmount, validateAllocation, type LectureCourseEntry } from '@/lib/lectures/pricing'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const studentId = request.nextUrl.searchParams.get('student_id')

  let query = supabase
    .from('lectures')
    .select('*, student:students(id, name, student_number)')
    .order('created_at', { ascending: false })

  if (studentId) {
    query = query.eq('student_id', studentId)
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
  const { student_id, label, grade, courses, notes } = body

  if (!student_id || !label || !grade || !courses?.length) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  const normalized = normalizeLectureCourses(grade, courses as LectureCourseEntry[])
  const allocError = validateAllocation(normalized)
  if (allocError) {
    return NextResponse.json({ error: allocError }, { status: 400 })
  }

  const total_amount = calcLectureTotalAmount(grade, normalized)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lectures')
    .insert({
      student_id,
      label,
      grade,
      courses: normalized,
      total_amount,
      notes: notes || '',
    })
    .select('*, student:students(id, name, student_number)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

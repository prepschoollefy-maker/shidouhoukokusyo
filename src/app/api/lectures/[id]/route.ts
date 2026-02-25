import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyContractPassword } from '@/lib/contracts/auth'
import { normalizeLectureCourses, calcLectureTotalAmount, validateAllocation, type LectureCourseEntry } from '@/lib/lectures/pricing'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const { data, error } = await supabase
    .from('lectures')
    .select('*, student:students(id, name, student_number)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const body = await request.json()
  const { student_id, label, grade, courses, notes } = body

  const updateData: Record<string, unknown> = {}
  if (student_id !== undefined) updateData.student_id = student_id
  if (label !== undefined) updateData.label = label
  if (grade !== undefined) updateData.grade = grade
  if (notes !== undefined) updateData.notes = notes

  if (grade && courses) {
    const normalized = normalizeLectureCourses(grade, courses as LectureCourseEntry[])
    const allocError = validateAllocation(normalized)
    if (allocError) {
      return NextResponse.json({ error: allocError }, { status: 400 })
    }
    updateData.courses = normalized
    updateData.total_amount = calcLectureTotalAmount(grade, normalized)
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lectures')
    .update(updateData)
    .eq('id', id)
    .select('*, student:students(id, name, student_number)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const admin = createAdminClient()
  const { error } = await admin.from('lectures').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

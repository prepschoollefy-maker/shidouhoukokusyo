import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const statusParam = request.nextUrl.searchParams.get('status') || 'active'

  let query = supabase
    .from('students')
    .select(`
      *,
      parent_emails(id, email, label),
      student_subjects(id, subject_id, subject:subjects(id, name)),
      teacher_student_assignments(id, teacher_id, subject_id, teacher:profiles(id, display_name))
    `)

  if (statusParam !== 'all') {
    query = query.eq('status', statusParam)
  }

  const { data, error } = await query.order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const {
    name, grade, send_mode, weekly_lesson_count,
    parent_emails, subject_ids, teacher_assignments
  } = body

  const admin = createAdminClient()

  const { data: student, error } = await admin
    .from('students')
    .insert({
      name,
      grade: grade || null,
      send_mode: send_mode || 'manual',
      weekly_lesson_count: weekly_lesson_count || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert parent emails
  if (parent_emails?.length) {
    await admin.from('parent_emails').insert(
      parent_emails.map((pe: { email: string; label?: string }) => ({
        student_id: student.id,
        email: pe.email,
        label: pe.label || null,
      }))
    )
  }

  // Insert student subjects
  if (subject_ids?.length) {
    await admin.from('student_subjects').insert(
      subject_ids.map((sid: string) => ({
        student_id: student.id,
        subject_id: sid,
      }))
    )
  }

  // Insert teacher assignments
  if (teacher_assignments?.length) {
    await admin.from('teacher_student_assignments').insert(
      teacher_assignments.map((ta: { teacher_id: string; subject_id?: string }) => ({
        teacher_id: ta.teacher_id,
        student_id: student.id,
        subject_id: ta.subject_id || null,
      }))
    )
  }

  return NextResponse.json({ data: student }, { status: 201 })
}

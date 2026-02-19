import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('students')
    .select(`
      *,
      parent_emails(id, email, label),
      student_subjects(id, subject_id, subject:subjects(id, name)),
      teacher_student_assignments(id, teacher_id, subject_id, teacher:profiles(id, display_name))
    `)
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

  const body = await request.json()
  const {
    name, grade, send_mode, weekly_lesson_count,
    parent_emails, subject_ids, teacher_assignments
  } = body

  const admin = createAdminClient()

  const { data: student, error } = await admin
    .from('students')
    .update({
      name,
      grade: grade || null,
      send_mode: send_mode || 'manual',
      weekly_lesson_count: weekly_lesson_count || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Replace parent emails
  if (parent_emails !== undefined) {
    await admin.from('parent_emails').delete().eq('student_id', id)
    if (parent_emails?.length) {
      await admin.from('parent_emails').insert(
        parent_emails.map((pe: { email: string; label?: string }) => ({
          student_id: id,
          email: pe.email,
          label: pe.label || null,
        }))
      )
    }
  }

  // Replace student subjects
  if (subject_ids !== undefined) {
    await admin.from('student_subjects').delete().eq('student_id', id)
    if (subject_ids?.length) {
      await admin.from('student_subjects').insert(
        subject_ids.map((sid: string) => ({ student_id: id, subject_id: sid }))
      )
    }
  }

  // Replace teacher assignments
  if (teacher_assignments !== undefined) {
    await admin.from('teacher_student_assignments').delete().eq('student_id', id)
    if (teacher_assignments?.length) {
      await admin.from('teacher_student_assignments').insert(
        teacher_assignments.map((ta: { teacher_id: string; subject_id?: string }) => ({
          teacher_id: ta.teacher_id,
          student_id: id,
          subject_id: ta.subject_id || null,
        }))
      )
    }
  }

  return NextResponse.json({ data: student })
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

  const admin = createAdminClient()
  const { error } = await admin.from('students').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

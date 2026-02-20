import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Delete related data without ON DELETE CASCADE first
  const condition = 'id' // dummy column to match all rows via neq
  const dummyId = '00000000-0000-0000-0000-000000000000'

  await admin.from('email_logs').delete().neq(condition, dummyId)
  await admin.from('summaries').delete().neq(condition, dummyId)
  await admin.from('lesson_reports').delete().neq(condition, dummyId)

  // Now delete students (CASCADE handles parent_emails, student_subjects, etc.)
  const { error } = await admin
    .from('students')
    .delete()
    .neq(condition, dummyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

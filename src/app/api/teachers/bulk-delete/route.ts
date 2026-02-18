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

  // Get all teacher profiles (exclude admin)
  const { data: teachers } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'teacher')

  if (!teachers?.length) {
    return NextResponse.json({ success: true, count: 0 })
  }

  const errors: string[] = []
  let count = 0

  for (const teacher of teachers) {
    const { error } = await admin.auth.admin.deleteUser(teacher.id)
    if (error) {
      errors.push(error.message)
    } else {
      count++
    }
  }

  return NextResponse.json({ success: true, count, errors: errors.length ? errors : undefined })
}

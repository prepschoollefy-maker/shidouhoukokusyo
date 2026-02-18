import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: users } = await admin.auth.admin.listUsers()

  const { data: profiles } = await admin
    .from('profiles')
    .select('*')
    .eq('role', 'teacher')

  const { data: assignments } = await admin
    .from('teacher_student_assignments')
    .select(`
      *,
      student:students(id, name),
      subject:subjects(id, name)
    `)

  const teachers = profiles?.map(p => {
    const authUser = users?.users?.find(u => u.id === p.id)
    return {
      ...p,
      email: authUser?.email || '',
      assignments: assignments?.filter(a => a.teacher_id === p.id) || [],
    }
  })

  return NextResponse.json({ data: teachers })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { email, display_name, password } = body

  const admin = createAdminClient()

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: password || Math.random().toString(36).slice(-8),
    email_confirm: true,
    user_metadata: {
      display_name,
      role: 'teacher',
    },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  return NextResponse.json({ data: { id: newUser.user.id, email, display_name } }, { status: 201 })
}

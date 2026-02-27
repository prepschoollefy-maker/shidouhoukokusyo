import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '30')
  const offset = (page - 1) * limit

  const admin = createAdminClient()

  let query = admin
    .from('students')
    .select(`
      id, name, grade,
      student_subjects(id, subject_id, subject:subjects(id, name))
    `, { count: 'exact' })
    .eq('status', 'active')
    .order('name')
    .range(offset, offset + limit - 1)

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

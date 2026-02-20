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

  const { data, error } = await admin
    .from('mendan_requests')
    .select(`
      *,
      student:students!inner(name),
      token:mendan_tokens!inner(period_label)
    `)
    .order('submitted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { id, handled } = body

  if (!id || typeof handled !== 'boolean') {
    return NextResponse.json({ error: 'id と handled は必須です' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('mendan_requests')
    .update({ handled })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { success: true } })
}

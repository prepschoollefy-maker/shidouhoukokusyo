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
    .from('mendan_records')
    .select('*, student:students!inner(name)')
    .order('mendan_date', { ascending: false })

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
  const { student_id, mendan_date, attendees, content } = body

  if (!student_id || !mendan_date) {
    return NextResponse.json({ error: '生徒と面談日は必須です' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('mendan_records')
    .insert({
      student_id,
      mendan_date,
      attendees: attendees || null,
      content: content || null,
      created_by: user.id,
    })
    .select('*, student:students!inner(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

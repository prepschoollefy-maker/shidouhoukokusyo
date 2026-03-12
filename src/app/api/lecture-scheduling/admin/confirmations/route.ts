import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { request_id, assignment_id, confirmed_date, time_slot_id, subject } = body

  if (!request_id || !assignment_id || !confirmed_date || !time_slot_id || !subject) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('lecture_scheduling_confirmations')
    .upsert(
      { request_id, assignment_id, confirmed_date, time_slot_id, subject, confirmed_at: new Date().toISOString() },
      { onConflict: 'request_id,confirmed_date,time_slot_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { request_id, confirmed_date, time_slot_id } = body

  if (!request_id || !confirmed_date || !time_slot_id) {
    return NextResponse.json({ error: 'request_id, confirmed_date, time_slot_id required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('lecture_scheduling_confirmations')
    .delete()
    .eq('request_id', request_id)
    .eq('confirmed_date', confirmed_date)
    .eq('time_slot_id', time_slot_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const status = new URL(request.url).searchParams.get('status')

  let query = supabase
    .from('reschedule_requests')
    .select(`
      *,
      lesson:lessons (
        id, lesson_date, lesson_type, status,
        student:students ( id, name ),
        teacher:profiles ( id, display_name ),
        subject:subjects ( id, name ),
        time_slot:time_slots ( id, slot_number, label, start_time ),
        booth:booths ( id, booth_number, label )
      ),
      new_lesson:lessons!reschedule_requests_new_lesson_id_fkey (
        id, lesson_date,
        time_slot:time_slots ( id, label, start_time )
      )
    `)
    .order('requested_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query

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
  const { lesson_id, requested_by, reason } = body

  // 元の授業のステータスを「rescheduled」に変更
  const { error: updateError } = await supabase
    .from('lessons')
    .update({ status: 'rescheduled' })
    .eq('id', lesson_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const { data, error } = await supabase
    .from('reschedule_requests')
    .insert({
      lesson_id,
      requested_by: requested_by || '管理者',
      reason: reason || '',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

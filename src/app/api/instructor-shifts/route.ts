import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const teacherId = new URL(request.url).searchParams.get('teacher_id')

  let query = supabase
    .from('instructor_shifts')
    .select(`
      *,
      teacher:profiles ( id, display_name ),
      time_slot:time_slots ( id, slot_number, label, start_time, end_time, sort_order )
    `)
    .order('day_of_week')

  if (teacherId) query = query.eq('teacher_id', teacherId)

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
  const { teacher_id, time_slot_id, shift_type, day_of_week, specific_date, is_available } = body

  const { data, error } = await supabase
    .from('instructor_shifts')
    .insert({
      teacher_id,
      time_slot_id,
      shift_type: shift_type || 'regular',
      day_of_week: shift_type === 'regular' ? day_of_week : null,
      specific_date: shift_type === 'specific' ? specific_date : null,
      is_available: is_available ?? true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '同じ時間帯に重複するシフトがあります' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

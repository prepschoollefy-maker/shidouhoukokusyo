import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  let query = supabase
    .from('lessons')
    .select(`
      *,
      student:students ( id, name ),
      teacher:profiles ( id, display_name ),
      subject:subjects ( id, name ),
      time_slot:time_slots ( id, slot_number, label, start_time, end_time, sort_order ),
      booth:booths ( id, booth_number, label )
    `)
    .order('lesson_date')

  if (startDate) query = query.gte('lesson_date', startDate)
  if (endDate) query = query.lte('lesson_date', endDate)

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
  const { student_id, teacher_id, subject_id, lesson_date, time_slot_id, booth_id, lesson_type, notes } = body

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      student_id,
      teacher_id,
      subject_id,
      lesson_date,
      time_slot_id,
      booth_id,
      lesson_type: lesson_type || 'regular',
      notes: notes || '',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '同じ日時に重複する授業があります' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

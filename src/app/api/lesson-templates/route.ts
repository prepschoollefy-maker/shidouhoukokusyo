import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('regular_lesson_templates')
    .select(`
      *,
      students ( id, name ),
      profiles!regular_lesson_templates_teacher_id_fkey ( id, display_name ),
      subjects ( id, name ),
      time_slots ( id, slot_number, label, start_time, end_time, sort_order ),
      booths ( id, booth_number, label )
    `)
    .order('day_of_week')

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
  const { student_id, teacher_id, subject_id, day_of_week, time_slot_id, booth_id, notes } = body

  const { data, error } = await supabase
    .from('regular_lesson_templates')
    .insert({ student_id, teacher_id, subject_id, day_of_week, time_slot_id, booth_id, notes: notes || '' })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '同じ曜日・時間帯に重複する登録があります' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

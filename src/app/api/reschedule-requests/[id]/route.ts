import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 振替申請の承認/却下
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { status, new_lesson } = body

  if (status === 'approved' && new_lesson) {
    // 振替先の授業を作成
    const { data: createdLesson, error: lessonError } = await supabase
      .from('lessons')
      .insert({
        student_id: new_lesson.student_id,
        teacher_id: new_lesson.teacher_id,
        subject_id: new_lesson.subject_id,
        lesson_date: new_lesson.lesson_date,
        time_slot_id: new_lesson.time_slot_id,
        booth_id: new_lesson.booth_id,
        lesson_type: 'makeup',
        notes: new_lesson.notes || '',
      })
      .select()
      .single()

    if (lessonError) {
      if (lessonError.code === '23505') {
        return NextResponse.json({ error: '振替先の日時に重複する授業があります' }, { status: 409 })
      }
      return NextResponse.json({ error: lessonError.message }, { status: 500 })
    }

    // 申請を承認に更新
    const { data, error } = await supabase
      .from('reschedule_requests')
      .update({
        status: 'approved',
        new_lesson_id: createdLesson.id,
        responded_at: new Date().toISOString(),
        responded_by: user.id,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  if (status === 'rejected') {
    // 却下 → 元の授業をscheduledに戻す
    const { data: req } = await supabase
      .from('reschedule_requests')
      .select('lesson_id')
      .eq('id', id)
      .single()

    if (req) {
      await supabase
        .from('lessons')
        .update({ status: 'scheduled' })
        .eq('id', req.lesson_id)
    }

    const { data, error } = await supabase
      .from('reschedule_requests')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
        responded_by: user.id,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  return NextResponse.json({ error: '不正なステータスです' }, { status: 400 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 振替授業を作成
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { original_lesson_id, lesson_date, time_slot_id, teacher_id, booth_id } = body

  if (!original_lesson_id || !lesson_date || !time_slot_id || !teacher_id) {
    return NextResponse.json({ error: '振替元授業・日付・コマ・講師は必須です' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 元授業を取得
  const { data: original, error: fetchErr } = await admin
    .from('lessons')
    .select('id, student_id, subject_id, status')
    .eq('id', original_lesson_id)
    .single()

  if (fetchErr || !original) {
    return NextResponse.json({ error: '元授業が見つかりません' }, { status: 404 })
  }
  if (original.status !== 'rescheduled') {
    return NextResponse.json({ error: '元授業が振替済みではありません' }, { status: 400 })
  }

  // 既にmakeup授業がないか確認
  const { data: existing } = await admin
    .from('lessons')
    .select('id')
    .eq('original_lesson_id', original_lesson_id)
    .neq('status', 'cancelled')

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'この授業には既に振替先が設定されています' }, { status: 409 })
  }

  // 振替授業を作成
  const { data, error } = await admin
    .from('lessons')
    .insert({
      student_id: original.student_id,
      teacher_id,
      subject_id: original.subject_id,
      lesson_date,
      time_slot_id,
      booth_id: booth_id || null,
      lesson_type: 'makeup',
      status: 'scheduled',
      original_lesson_id,
      notes: '',
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

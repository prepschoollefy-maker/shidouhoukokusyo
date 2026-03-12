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
  const { type, ...params } = body
  const admin = createAdminClient()

  // 講師のOKをトグル
  if (type === 'teacher_ok') {
    const { assignment_id, available_date, time_slot_id } = params

    // 既存のレスポンスを検索
    const { data: existing } = await admin
      .from('lecture_scheduling_responses')
      .select('id')
      .eq('assignment_id', assignment_id)
      .eq('available_date', available_date)
      .eq('time_slot_id', time_slot_id)

    if (existing && existing.length > 0) {
      // OK → 削除（NGに）
      await admin
        .from('lecture_scheduling_responses')
        .delete()
        .eq('assignment_id', assignment_id)
        .eq('available_date', available_date)
        .eq('time_slot_id', time_slot_id)
      return NextResponse.json({ action: 'removed' })
    } else {
      // 空 → OK追加
      const { error } = await admin
        .from('lecture_scheduling_responses')
        .insert({
          assignment_id,
          available_date,
          time_slot_id,
          submitted_at: new Date().toISOString(),
        })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ action: 'added' })
    }
  }

  // 生徒のNGをトグル
  if (type === 'student_ng') {
    const { request_id, ng_date, time_slot_id } = params

    // 既存のNGを検索
    const { data: existing } = await admin
      .from('lecture_scheduling_ng_slots')
      .select('id')
      .eq('request_id', request_id)
      .eq('ng_date', ng_date)
      .eq('time_slot_id', time_slot_id)

    if (existing && existing.length > 0) {
      // NG → 削除（OKに）
      await admin
        .from('lecture_scheduling_ng_slots')
        .delete()
        .eq('request_id', request_id)
        .eq('ng_date', ng_date)
        .eq('time_slot_id', time_slot_id)
      return NextResponse.json({ action: 'removed' })
    } else {
      // 空 → NG追加
      const { error } = await admin
        .from('lecture_scheduling_ng_slots')
        .insert({
          request_id,
          ng_date,
          time_slot_id,
        })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ action: 'added' })
    }
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

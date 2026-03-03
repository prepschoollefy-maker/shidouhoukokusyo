import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 授業を振替済みにする
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // 対象授業を取得して検証
  const { data: lesson, error: fetchErr } = await admin
    .from('lessons')
    .select('id, status')
    .eq('id', id)
    .single()

  if (fetchErr || !lesson) {
    return NextResponse.json({ error: '授業が見つかりません' }, { status: 404 })
  }
  if (lesson.status !== 'scheduled') {
    return NextResponse.json({ error: 'この授業は振替対象にできません' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('lessons')
    .update({ status: 'rescheduled' })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// 振替取消（makeup授業削除＋元授業をscheduledに戻す）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // 対象授業がrescheduledか確認
  const { data: lesson, error: fetchErr } = await admin
    .from('lessons')
    .select('id, status')
    .eq('id', id)
    .single()

  if (fetchErr || !lesson) {
    return NextResponse.json({ error: '授業が見つかりません' }, { status: 404 })
  }
  if (lesson.status !== 'rescheduled') {
    return NextResponse.json({ error: 'この授業は振替済みではありません' }, { status: 400 })
  }

  // 対応するmakeup授業を削除
  await admin
    .from('lessons')
    .delete()
    .eq('original_lesson_id', id)

  // 元授業をscheduledに戻す
  const { data, error } = await admin
    .from('lessons')
    .update({ status: 'scheduled' })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

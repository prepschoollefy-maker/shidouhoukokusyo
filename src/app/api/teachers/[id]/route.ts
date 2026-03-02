import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // FK制約のある関連データを先にNULL化または削除
  await admin.from('lesson_reports').update({ teacher_id: null }).eq('teacher_id', id)
  await admin.from('mendan_records').update({ created_by: null }).eq('created_by', id)
  // CASCADE設定済みだが明示的に削除
  await admin.from('teacher_student_assignments').delete().eq('teacher_id', id)
  await admin.from('profiles').delete().eq('id', id)

  // 認証ユーザーも削除
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

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
  const { display_name } = body

  const admin = createAdminClient()

  if (display_name) {
    await admin.from('profiles').update({ display_name }).eq('id', id)
  }

  return NextResponse.json({ success: true })
}

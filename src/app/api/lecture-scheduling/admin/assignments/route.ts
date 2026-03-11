import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 講師アサイン一覧取得
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requestId = request.nextUrl.searchParams.get('request_id')
  if (!requestId) return NextResponse.json({ error: 'request_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lecture_scheduling_assignments')
    .select('*, teacher:profiles(id, display_name)')
    .eq('request_id', requestId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// 講師をアサイン
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { request_id, teacher_id, expires_at } = body
  if (!request_id || !teacher_id) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  const admin = createAdminClient()

  // デフォルト有効期限: 講習開始3日前
  let expiry = expires_at
  if (!expiry) {
    const { data: req } = await admin
      .from('lecture_scheduling_requests')
      .select('period:lecture_scheduling_periods(start_date)')
      .eq('id', request_id)
      .single()
    const periodData = req?.period as unknown as { start_date: string } | null
    if (periodData) {
      const d = new Date(periodData.start_date)
      d.setDate(d.getDate() - 3)
      d.setHours(23, 59, 59)
      expiry = d.toISOString()
    } else {
      const d = new Date()
      d.setDate(d.getDate() + 14)
      expiry = d.toISOString()
    }
  }

  const { data, error } = await admin
    .from('lecture_scheduling_assignments')
    .insert({ request_id, teacher_id, expires_at: expiry })
    .select('*, teacher:profiles(id, display_name)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'この講師は既にアサイン済みです' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

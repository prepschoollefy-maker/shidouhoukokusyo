import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('student_suspensions')
    .select('*')
    .eq('student_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

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

  const body = await request.json()
  const { start_ym, end_ym, reason } = body

  if (!start_ym || !end_ym) {
    return NextResponse.json({ error: '開始月と終了月は必須です' }, { status: 400 })
  }
  if (start_ym > end_ym) {
    return NextResponse.json({ error: '開始月は終了月以前にしてください' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 休塾レコードを作成
  const { data: suspension, error } = await admin
    .from('student_suspensions')
    .insert({ student_id: id, start_ym, end_ym, reason: reason || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 休塾期間内の scheduled 授業をキャンセル
  const startDate = `${start_ym}-01`
  // end_ym の月末を計算
  const [ey, em] = end_ym.split('-').map(Number)
  const endDate = new Date(ey, em, 0).toISOString().split('T')[0]

  const { data: cancelled } = await admin
    .from('lessons')
    .update({ status: 'cancelled' })
    .eq('student_id', id)
    .eq('status', 'scheduled')
    .gte('lesson_date', startDate)
    .lte('lesson_date', endDate)
    .select('id')

  return NextResponse.json({
    data: suspension,
    lessonsCancelled: cancelled?.length || 0,
  })
}

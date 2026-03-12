import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 生徒個別トークンの一覧取得
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const periodId = request.nextUrl.searchParams.get('period_id')
  if (!periodId) return NextResponse.json({ error: 'period_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('lecture_scheduling_student_tokens')
    .select('id, period_id, student_id, token, created_at, student:students(id, name, student_number, grade)')
    .eq('period_id', periodId)
    .order('created_at')

  return NextResponse.json(data || [])
}

// 生徒個別トークンの作成（複数対応）
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { period_id, student_ids } = body as { period_id: string; student_ids: string[] }

  if (!period_id || !student_ids?.length) {
    return NextResponse.json({ error: 'period_id and student_ids required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 既存トークンを除外
  const { data: existing } = await admin
    .from('lecture_scheduling_student_tokens')
    .select('student_id')
    .eq('period_id', period_id)
    .in('student_id', student_ids)

  const existingIds = new Set((existing || []).map(e => e.student_id))
  const newIds = student_ids.filter(id => !existingIds.has(id))

  if (newIds.length === 0) {
    return NextResponse.json({ created: 0, message: '全員のURLは発行済みです' })
  }

  const rows = newIds.map(student_id => ({ period_id, student_id }))
  const { error } = await admin
    .from('lecture_scheduling_student_tokens')
    .insert(rows)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ created: newIds.length })
}

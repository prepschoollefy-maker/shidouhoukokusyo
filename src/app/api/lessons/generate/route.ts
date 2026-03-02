import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { start_date, end_date } = body

  if (!start_date || !end_date) {
    return NextResponse.json({ error: '開始日と終了日を指定してください' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: created, error } = await admin.rpc('generate_lessons_for_range', {
    p_start_date: start_date,
    p_end_date: end_date,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    message: `${created}件の授業を生成しました`,
    created: created || 0,
    skipped: 0,
  })
}

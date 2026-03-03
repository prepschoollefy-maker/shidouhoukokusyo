import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 個別テンプレートから授業を一括生成
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { template_id, start_date, end_date } = body

  if (!template_id || !start_date || !end_date) {
    return NextResponse.json({ error: 'テンプレートID・開始日・終了日は必須です' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin.rpc('generate_lessons_for_template', {
    p_template_id: template_id,
    p_start_date: start_date,
    p_end_date: end_date,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: data, message: `${data}件の授業を生成しました` })
}

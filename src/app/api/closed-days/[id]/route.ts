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

  // 休館日のレコードを取得（日付が必要）
  const { data: closedDay, error: fetchError } = await admin
    .from('closed_days')
    .select('closed_date')
    .eq('id', id)
    .single()

  if (fetchError || !closedDay) {
    return NextResponse.json({ error: '休館日が見つかりません' }, { status: 404 })
  }

  // 休館日を削除
  const { error } = await admin.from('closed_days').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // その日の授業をテンプレートから再生成
  let generatedCount = 0
  const { data: rpcResult, error: rpcError } = await admin.rpc(
    'generate_lessons_for_range',
    { p_start_date: closedDay.closed_date, p_end_date: closedDay.closed_date }
  )

  if (!rpcError && rpcResult !== null) {
    generatedCount = rpcResult
  }

  return NextResponse.json({ success: true, generatedCount })
}

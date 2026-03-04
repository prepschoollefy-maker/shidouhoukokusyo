import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; suspensionId: string }> }
) {
  const { id, suspensionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // 休塾レコードを取得（期間を把握するため）
  const { data: suspension, error: fetchError } = await admin
    .from('student_suspensions')
    .select('*')
    .eq('id', suspensionId)
    .eq('student_id', id)
    .single()

  if (fetchError || !suspension) {
    return NextResponse.json({ error: '休塾レコードが見つかりません' }, { status: 404 })
  }

  // レコード削除
  const { error: deleteError } = await admin
    .from('student_suspensions')
    .delete()
    .eq('id', suspensionId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  // 該当期間の授業を再生成
  const startDate = `${suspension.start_ym}-01`
  const [ey, em] = suspension.end_ym.split('-').map(Number)
  const endDate = new Date(ey, em, 0).toISOString().split('T')[0]

  const { data: lessonsGenerated } = await admin.rpc('generate_lessons_for_range', {
    p_start_date: startDate,
    p_end_date: endDate,
  })

  return NextResponse.json({ lessonsGenerated: lessonsGenerated || 0 })
}

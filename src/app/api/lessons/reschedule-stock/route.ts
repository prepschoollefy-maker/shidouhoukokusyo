import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // 1. rescheduledな授業を取得
  const { data: rescheduled, error: err1 } = await admin
    .from('lessons')
    .select('*, student:students(id,name), teacher:profiles(id,display_name), subject:subjects(id,name), time_slot:time_slots(id,label,start_time)')
    .eq('status', 'rescheduled')
    .order('lesson_date', { ascending: false })

  if (err1) return NextResponse.json({ error: err1.message }, { status: 500 })
  if (!rescheduled || rescheduled.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // 2. 対応するmakeup授業があるものを除外
  const ids = rescheduled.map((l: { id: string }) => l.id)
  const { data: makeups, error: err2 } = await admin
    .from('lessons')
    .select('original_lesson_id')
    .in('original_lesson_id', ids)
    .neq('status', 'cancelled')

  if (err2) return NextResponse.json({ error: err2.message }, { status: 500 })

  const consumedIds = new Set((makeups || []).map((m: { original_lesson_id: string }) => m.original_lesson_id))
  const stock = rescheduled.filter((l: { id: string }) => !consumedIds.has(l.id))

  return NextResponse.json({ data: stock })
}

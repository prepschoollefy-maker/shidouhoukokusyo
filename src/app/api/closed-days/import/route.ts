import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows } = await request.json()
  if (!rows?.length) {
    return NextResponse.json({ error: 'データがありません' }, { status: 400 })
  }

  const admin = createAdminClient()
  const errors: string[] = []
  const inserted: string[] = []
  let skippedCount = 0

  for (const row of rows) {
    const raw = row['日付']
    if (!raw) { errors.push('日付が空の行があります'); continue }

    // 2026/1/1 → 2026-01-01
    const parts = String(raw).trim().split('/')
    if (parts.length !== 3) { errors.push(`不正な日付: ${raw}`); continue }
    const [y, m, d] = parts
    const normalized = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`

    if (isNaN(Date.parse(normalized))) { errors.push(`不正な日付: ${raw}`); continue }

    const { error } = await admin
      .from('closed_days')
      .insert({ closed_date: normalized, reason: '' })

    if (error) {
      if (error.code === '23505') { skippedCount++; continue }
      errors.push(`${raw}: ${error.message}`)
      continue
    }
    inserted.push(normalized)
  }

  // 挿入された日付の授業を自動キャンセル
  let cancelledCount = 0
  if (inserted.length > 0) {
    const { data: cancelled } = await admin
      .from('lessons')
      .update({ status: 'cancelled' })
      .in('lesson_date', inserted)
      .eq('status', 'scheduled')
      .select('id')
    cancelledCount = cancelled?.length || 0
  }

  return NextResponse.json({
    count: inserted.length,
    skippedCount,
    cancelledCount,
    errors: errors.length > 0 ? errors : undefined,
  }, { status: 201 })
}

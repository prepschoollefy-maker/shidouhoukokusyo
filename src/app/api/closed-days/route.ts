import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  let query = admin
    .from('closed_days')
    .select('*')
    .order('closed_date')

  if (startDate) query = query.gte('closed_date', startDate)
  if (endDate) query = query.lte('closed_date', endDate)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { closed_date, closed_dates, reason } = body

  // 一括登録（配列）
  if (Array.isArray(closed_dates) && closed_dates.length > 0) {
    const admin = createAdminClient()
    const rows = closed_dates.map((d: string) => ({ closed_date: d, reason: reason || '' }))

    // 重複はスキップしつつ一括挿入
    const inserted: Array<{ id: string; closed_date: string; reason: string }> = []
    const skipped: string[] = []

    for (const row of rows) {
      const { data, error } = await admin
        .from('closed_days')
        .insert(row)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          skipped.push(row.closed_date)
          continue
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      inserted.push(data)
    }

    // 挿入された日付の授業を自動キャンセル
    let cancelledCount = 0
    if (inserted.length > 0) {
      const dates = inserted.map((r) => r.closed_date)
      const { data: cancelled } = await admin
        .from('lessons')
        .update({ status: 'cancelled' })
        .in('lesson_date', dates)
        .eq('status', 'scheduled')
        .select('id')
      cancelledCount = cancelled?.length || 0
    }

    return NextResponse.json({
      data: inserted,
      skippedCount: skipped.length,
      cancelledCount,
    }, { status: 201 })
  }

  // 単一登録（既存互換）
  if (!closed_date) {
    return NextResponse.json({ error: '日付を指定してください' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 休館日を追加
  const { data, error } = await admin
    .from('closed_days')
    .insert({ closed_date, reason: reason || '' })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'この日付は既に休館日に設定されています' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // その日の scheduled な授業を自動キャンセル
  const { data: cancelled } = await admin
    .from('lessons')
    .update({ status: 'cancelled' })
    .eq('lesson_date', closed_date)
    .eq('status', 'scheduled')
    .select('id')

  const cancelledCount = cancelled?.length || 0

  return NextResponse.json({ data, cancelledCount }, { status: 201 })
}

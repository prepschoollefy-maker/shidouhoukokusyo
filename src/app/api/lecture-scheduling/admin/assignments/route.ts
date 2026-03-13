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

  // 同じ講師の同期間の既存回答をコピー（講師が何度も回答しなくて済むように）
  try {
    // このリクエストの期間IDを取得
    const { data: thisReq } = await admin
      .from('lecture_scheduling_requests')
      .select('period_id')
      .eq('id', request_id)
      .single()

    if (thisReq) {
      // 同じ講師の同期間の回答済みアサインを取得
      const { data: otherAssignments } = await admin
        .from('lecture_scheduling_assignments')
        .select('id, request:lecture_scheduling_requests(period_id)')
        .eq('teacher_id', teacher_id)
        .eq('status', 'responded')
        .neq('id', data.id)

      const sameperiodIds = (otherAssignments || [])
        .filter((a: { request: unknown }) => {
          const r = a.request as { period_id: string } | null
          return r && r.period_id === thisReq.period_id
        })
        .map((a: { id: string }) => a.id)

      if (sameperiodIds.length > 0) {
        const { data: otherResp } = await admin
          .from('lecture_scheduling_responses')
          .select('available_date, time_slot_id')
          .in('assignment_id', sameperiodIds)

        if (otherResp && otherResp.length > 0) {
          // 重複排除してコピー
          const seen = new Set<string>()
          const rows = otherResp
            .filter(r => {
              const key = `${r.available_date}|${r.time_slot_id}`
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })
            .map(r => ({
              assignment_id: data.id,
              available_date: r.available_date,
              time_slot_id: r.time_slot_id,
            }))

          await admin.from('lecture_scheduling_responses').insert(rows)
          // ステータスを回答済みに更新
          await admin
            .from('lecture_scheduling_assignments')
            .update({ status: 'responded' })
            .eq('id', data.id)
          data.status = 'responded'
        }
      }
    }
  } catch {
    // コピー失敗しても本体のアサインは成功しているのでエラーにしない
  }

  return NextResponse.json(data)
}

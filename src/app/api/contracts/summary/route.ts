import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyContractPassword } from '@/lib/contracts/auth'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const now = new Date()
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(now.getFullYear()))
  const month = parseInt(request.nextUrl.searchParams.get('month') || String(now.getMonth() + 1))

  // 12ヶ月分の範囲を計算（当月含む過去12ヶ月）
  const endYear = year
  const endMonth = month
  const startYear = month <= 11 ? year - 1 : year
  const startMonth = ((month - 12 + 11) % 12) + 1

  const rangeStart = `${startYear}-${String(startMonth).padStart(2, '0')}-01`
  const rangeEnd = new Date(endYear, endMonth, 0).toISOString().split('T')[0]

  // 1クエリで全期間の契約を取得
  const { data, error } = await supabase
    .from('contracts')
    .select('id, student_id, start_date, end_date, monthly_amount, enrollment_fee, campaign_discount')
    .lte('start_date', rangeEnd)
    .gte('end_date', rangeStart)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contracts = data || []

  // JS側で月別集計
  const months: { year: number; month: number; revenue: number; count: number }[] = []
  for (let i = 0; i < 12; i++) {
    let m = startMonth + i
    let y = startYear
    if (m > 12) { m -= 12; y += 1 }

    const firstDay = new Date(y, m - 1, 1)
    const lastDay = new Date(y, m, 0)

    let revenue = 0
    const studentIds = new Set<string>()

    for (const c of contracts) {
      const cStart = new Date(c.start_date)
      const cEnd = new Date(c.end_date)
      if (cStart <= lastDay && cEnd >= firstDay) {
        const isFirstMonth = cStart.getFullYear() === y && cStart.getMonth() + 1 === m
        const isHalf = isFirstMonth && cStart.getDate() >= 16

        // 授業料（16日開始の初月は半額）
        let monthRevenue = isHalf ? Math.floor(c.monthly_amount / 2) : c.monthly_amount
        // 設備利用料
        monthRevenue += isHalf ? 1650 : 3300
        // 初月: 入塾金 - キャンペーン割引
        if (isFirstMonth) {
          monthRevenue += (c.enrollment_fee || 0)
          monthRevenue -= (c.campaign_discount || 0)
        }

        revenue += monthRevenue
        studentIds.add(c.student_id)
      }
    }

    months.push({ year: y, month: m, revenue, count: studentIds.size })
  }

  return NextResponse.json({ data: months })
}

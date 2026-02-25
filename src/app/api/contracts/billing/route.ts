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

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('contracts')
    .select('*, student:students(id, name, student_number)')
    .lte('start_date', lastDay)
    .gte('end_date', firstDay)
    .order('start_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 16日開始の初月は月謝半額
  const billing = (data || []).map((c) => {
    const startDate = new Date(c.start_date)
    const startDay = startDate.getDate()
    const startYear = startDate.getFullYear()
    const startMonth = startDate.getMonth() + 1
    const isFirstMonth = startYear === year && startMonth === month
    const isHalf = isFirstMonth && startDay === 16
    const effectiveAmount = isHalf ? Math.floor(c.monthly_amount / 2) : c.monthly_amount
    return { ...c, effective_amount: effectiveAmount }
  })

  const total = billing.reduce((sum, b) => sum + b.effective_amount, 0)

  return NextResponse.json({ data: billing, total })
}

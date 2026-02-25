import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcMonthlyAmount, CourseEntry } from '@/lib/contracts/pricing'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { grade, courses } = await request.json()
  if (!grade || !courses?.length) {
    return NextResponse.json({ error: '学年とコースを指定してください' }, { status: 400 })
  }

  const monthly_amount = calcMonthlyAmount(grade, courses as CourseEntry[])
  return NextResponse.json({ monthly_amount })
}

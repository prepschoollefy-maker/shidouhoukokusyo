import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyContractPassword } from '@/lib/contracts/auth'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const studentId = request.nextUrl.searchParams.get('student_id')
  const startDate = request.nextUrl.searchParams.get('start_date')
  const endDate = request.nextUrl.searchParams.get('end_date')
  const excludeId = request.nextUrl.searchParams.get('exclude_id')

  if (!studentId) return NextResponse.json({ error: 'student_id is required' }, { status: 400 })

  // 同じ生徒の全契約を取得
  let query = supabase
    .from('contracts')
    .select('id, start_date, end_date, courses')
    .eq('student_id', studentId)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contracts = data || []
  const hasExistingContract = contracts.length > 0

  // 日付重複チェック
  let overlappingContracts: { id: string; start_date: string; end_date: string; courses: { course: string }[] }[] = []
  if (startDate && endDate) {
    overlappingContracts = contracts.filter(c =>
      c.start_date <= endDate && c.end_date >= startDate
    )
  }

  return NextResponse.json({
    has_existing_contract: hasExistingContract,
    overlapping_contracts: overlappingContracts,
  })
}

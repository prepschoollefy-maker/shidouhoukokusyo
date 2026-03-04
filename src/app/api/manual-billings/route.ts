import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyContractPassword } from '@/lib/contracts/auth'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const year = request.nextUrl.searchParams.get('year')
  const month = request.nextUrl.searchParams.get('month')

  const admin = createAdminClient()
  let query = admin
    .from('manual_billings')
    .select('*, student:students(id, name, student_number, payment_method, direct_debit_start_ym)')
    .order('created_at', { ascending: true })

  if (year) query = query.eq('year', parseInt(year))
  if (month) query = query.eq('month', parseInt(month))

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

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const body = await request.json()
  const { student_id, year, month, amount, description, notes } = body

  if (!student_id || !year || !month || !amount || !description) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('manual_billings')
    .insert({
      student_id,
      year,
      month,
      amount,
      description,
      notes: notes || '',
    })
    .select('*, student:students(id, name, student_number, payment_method, direct_debit_start_ym)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

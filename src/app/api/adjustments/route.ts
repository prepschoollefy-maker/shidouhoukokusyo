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
  const studentId = request.nextUrl.searchParams.get('student_id')

  const admin = createAdminClient()
  let query = admin
    .from('adjustments')
    .select('*, student:students(id, name, student_number), contract:contracts(id, courses, monthly_amount), lecture:lectures(id, label), material_sale:material_sales(id, item_name)')
    .order('created_at', { ascending: false })

  if (year) query = query.eq('year', parseInt(year))
  if (month) query = query.eq('month', parseInt(month))
  if (studentId) query = query.eq('student_id', studentId)

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
  const { student_id, year, month, amount, reason, notes, contract_id, lecture_id, material_sale_id } = body

  if (!student_id || !year || !month || amount === undefined) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  const admin = createAdminClient()
  const insertData: Record<string, unknown> = {
    student_id,
    year,
    month,
    amount,
    reason: reason || '',
    notes: notes || '',
  }
  if (contract_id) insertData.contract_id = contract_id
  if (lecture_id) insertData.lecture_id = lecture_id
  if (material_sale_id) insertData.material_sale_id = material_sale_id

  const { data, error } = await admin
    .from('adjustments')
    .insert(insertData)
    .select('*, student:students(id, name, student_number), contract:contracts(id, courses, monthly_amount), lecture:lectures(id, label), material_sale:material_sales(id, item_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

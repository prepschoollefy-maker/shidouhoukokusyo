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

  const studentId = request.nextUrl.searchParams.get('student_id')
  const billingYear = request.nextUrl.searchParams.get('billing_year')
  const billingMonth = request.nextUrl.searchParams.get('billing_month')

  const admin = createAdminClient()
  let query = admin
    .from('material_sales')
    .select('*, student:students(id, name, student_number)')
    .order('sale_date', { ascending: false })

  if (studentId) query = query.eq('student_id', studentId)
  if (billingYear) query = query.eq('billing_year', parseInt(billingYear))
  if (billingMonth) query = query.eq('billing_month', parseInt(billingMonth))

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
  const { student_id, item_name, unit_price, quantity, sale_date, billing_year, billing_month, notes } = body

  if (!student_id || !item_name || !sale_date || !billing_year || !billing_month) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  const qty = quantity || 1
  const price = unit_price || 0
  const total_amount = price * qty

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('material_sales')
    .insert({
      student_id,
      item_name,
      unit_price: price,
      quantity: qty,
      total_amount,
      sale_date,
      billing_year,
      billing_month,
      notes: notes || '',
    })
    .select('*, student:students(id, name, student_number)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

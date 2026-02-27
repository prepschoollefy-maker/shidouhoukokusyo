import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyContractPassword } from '@/lib/contracts/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('material_sales')
    .select('*, student:students(id, name, student_number)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const body = await request.json()
  const { student_id, item_name, unit_price, quantity, sale_date, billing_year, billing_month, notes } = body

  const updateData: Record<string, unknown> = {}
  if (student_id !== undefined) updateData.student_id = student_id
  if (item_name !== undefined) updateData.item_name = item_name
  if (sale_date !== undefined) updateData.sale_date = sale_date
  if (billing_year !== undefined) updateData.billing_year = billing_year
  if (billing_month !== undefined) updateData.billing_month = billing_month
  if (notes !== undefined) updateData.notes = notes

  if (unit_price !== undefined || quantity !== undefined) {
    const price = unit_price ?? 0
    const qty = quantity ?? 1
    updateData.unit_price = price
    updateData.quantity = qty
    updateData.total_amount = price * qty
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('material_sales')
    .update(updateData)
    .eq('id', id)
    .select('*, student:students(id, name, student_number)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const admin = createAdminClient()
  const { error } = await admin.from('material_sales').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

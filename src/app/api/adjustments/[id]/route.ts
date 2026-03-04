import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyContractPassword } from '@/lib/contracts/auth'

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
  const { amount, reason, status, completed_date, notes, contract_id, lecture_id, material_sale_id } = body

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (amount !== undefined) updateData.amount = amount
  if (reason !== undefined) updateData.reason = reason
  if (notes !== undefined) updateData.notes = notes
  if (contract_id !== undefined) updateData.contract_id = contract_id
  if (lecture_id !== undefined) updateData.lecture_id = lecture_id
  if (material_sale_id !== undefined) updateData.material_sale_id = material_sale_id
  if (status !== undefined) {
    updateData.status = status
    if (status === '対応済み' && !completed_date) {
      updateData.completed_date = new Date().toISOString().split('T')[0]
    }
  }
  if (completed_date !== undefined) updateData.completed_date = completed_date

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('adjustments')
    .update(updateData)
    .eq('id', id)
    .select('*, student:students(id, name, student_number), contract:contracts(id, courses, monthly_amount), lecture:lectures(id, label), material_sale:material_sales(id, item_name)')
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
  const { error } = await admin.from('adjustments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

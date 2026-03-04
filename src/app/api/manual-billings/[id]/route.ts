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
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.amount !== undefined) updateData.amount = body.amount
  if (body.description !== undefined) updateData.description = body.description
  if (body.notes !== undefined) updateData.notes = body.notes

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('manual_billings')
    .update(updateData)
    .eq('id', id)
    .select('*, student:students(id, name, student_number, payment_method, direct_debit_start_ym)')
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
  const { error } = await admin.from('manual_billings').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

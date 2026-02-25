import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyContractPassword } from '@/lib/contracts/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const { id } = await params
  const body = await request.json()
  const { paid_amount, billed_amount, payment_date, payment_method, followup_status, notes } = body

  const admin = createAdminClient()

  // 既存レコード取得
  const { data: existing, error: fetchError } = await admin
    .from('payments')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: '入金記録が見つかりません' }, { status: 404 })
  }

  const paidAmt = paid_amount ?? existing.paid_amount
  const billedAmt = billed_amount ?? existing.billed_amount
  const difference = paidAmt - billedAmt
  const status = paidAmt === 0 ? '未入金' : difference === 0 ? '入金済み' : '過不足あり'

  const { data, error } = await admin
    .from('payments')
    .update({
      paid_amount: paidAmt,
      billed_amount: billedAmt,
      difference,
      status,
      payment_date: payment_date !== undefined ? payment_date : existing.payment_date,
      payment_method: payment_method !== undefined ? payment_method : existing.payment_method,
      followup_status: followup_status !== undefined ? followup_status : existing.followup_status,
      notes: notes !== undefined ? notes : existing.notes,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const { id } = await params
  const admin = createAdminClient()

  const { error } = await admin
    .from('payments')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

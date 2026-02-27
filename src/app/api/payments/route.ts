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

  const year = parseInt(request.nextUrl.searchParams.get('year') || '')
  const month = parseInt(request.nextUrl.searchParams.get('month') || '')
  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 })
  }

  // admin client で読み取り（RLS をバイパス、認証+パスワードで保護済み）
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('payments')
    .select('*')
    .eq('year', year)
    .eq('month', month)

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
  const {
    billing_type, contract_id, lecture_id, material_sale_id,
    year, month, billed_amount, paid_amount,
    payment_date, payment_method, notes,
  } = body

  if (!billing_type || !year || !month) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  const paidAmt = paid_amount || 0
  const billedAmt = billed_amount || 0
  const difference = paidAmt - billedAmt
  const status = paidAmt === 0 ? '未入金' : difference === 0 ? '入金済み' : '過不足あり'

  const admin = createAdminClient()

  // 既存レコードチェック
  let query = admin.from('payments').select('id').eq('year', year).eq('month', month)
  if (billing_type === 'contract') {
    query = query.eq('contract_id', contract_id)
  } else if (billing_type === 'lecture') {
    query = query.eq('lecture_id', lecture_id)
  } else if (billing_type === 'material') {
    query = query.eq('material_sale_id', material_sale_id)
  }
  const { data: existing } = await query.maybeSingle()

  const record = {
    billing_type,
    contract_id: billing_type === 'contract' ? contract_id : null,
    lecture_id: billing_type === 'lecture' ? lecture_id : null,
    material_sale_id: billing_type === 'material' ? material_sale_id : null,
    year,
    month,
    billed_amount: billedAmt,
    paid_amount: paidAmt,
    difference,
    status,
    payment_date: payment_date || null,
    payment_method: payment_method || null,
    notes: notes || '',
  }

  if (existing) {
    const { data, error } = await admin
      .from('payments')
      .update(record)
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } else {
    const { data, error } = await admin
      .from('payments')
      .insert(record)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }
}

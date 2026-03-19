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

  const year = parseInt(request.nextUrl.searchParams.get('year') || '0')
  const month = parseInt(request.nextUrl.searchParams.get('month') || '0')
  if (!year || !month) return NextResponse.json({ error: 'year, month required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('billing_overrides')
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
  const { billing_type, ref_id, year, month, override_type, override_amount, reason } = body

  if (!billing_type || !ref_id || !year || !month || !override_type) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 確定済みチェック
  const { data: confirmation } = await admin
    .from('billing_confirmations')
    .select('id')
    .eq('billing_type', billing_type)
    .eq('ref_id', ref_id)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (confirmation) {
    return NextResponse.json({ error: '確定済みの請求は変更できません' }, { status: 400 })
  }

  // upsert
  const { data, error } = await admin
    .from('billing_overrides')
    .upsert({
      billing_type,
      ref_id,
      year,
      month,
      override_type,
      override_amount: override_type === 'amount' ? override_amount : null,
      reason: reason || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'billing_type,ref_id,year,month' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

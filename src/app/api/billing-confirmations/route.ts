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

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('billing_confirmations')
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
  const { items, year, month } = body as {
    items: { billing_type: string; ref_id: string; snapshot: Record<string, unknown> }[]
    year: number
    month: number
  }

  if (!items?.length || !year || !month) {
    return NextResponse.json({ error: 'items, year, month are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const rows = items.map(item => ({
    billing_type: item.billing_type,
    ref_id: item.ref_id,
    year,
    month,
    snapshot: item.snapshot,
    confirmed_at: new Date().toISOString(),
  }))

  const { error } = await admin
    .from('billing_confirmations')
    .upsert(rows, { onConflict: 'billing_type,ref_id,year,month' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ confirmed: rows.length })
}

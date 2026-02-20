import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMendanEmails } from '@/lib/mendan/send-mendan-emails'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { period_label, custom_body } = body

  if (!period_label) {
    return NextResponse.json({ error: '期間ラベルを入力してください' }, { status: 400 })
  }

  const result = await sendMendanEmails(period_label, custom_body || undefined)
  return NextResponse.json({ data: result })
}

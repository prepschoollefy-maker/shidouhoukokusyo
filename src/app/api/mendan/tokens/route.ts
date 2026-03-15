import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateShortToken } from '@/lib/mendan/token'

// 特定の生徒に対してトークン（リンク）を手動発行する
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { student_id, period_label } = body

  if (!student_id || !period_label) {
    return NextResponse.json({ error: '生徒と期間ラベルは必須です' }, { status: 400 })
  }

  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lefy-platform.vercel.app'

  // Check if token already exists
  const { data: existing } = await admin
    .from('mendan_tokens')
    .select('token')
    .eq('student_id', student_id)
    .eq('period_label', period_label)
    .limit(1)

  if (existing?.length) {
    // Return existing token URL
    const url = `${appUrl}/m/${existing[0].token}`
    return NextResponse.json({ data: { url, existing: true } })
  }

  // Create new token (short 8-char string)
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const token = generateShortToken()

  const { data: tokenRow, error } = await admin
    .from('mendan_tokens')
    .insert({
      student_id,
      period_label,
      expires_at: expiresAt,
      token,
    })
    .select('token')
    .single()

  if (error || !tokenRow) {
    return NextResponse.json({ error: 'トークン生成に失敗しました' }, { status: 500 })
  }

  const url = `${appUrl}/m/${tokenRow.token}`
  return NextResponse.json({ data: { url, existing: false } }, { status: 201 })
}

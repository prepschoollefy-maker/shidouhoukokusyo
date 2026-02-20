import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: tokenRow, error } = await admin
    .from('mendan_tokens')
    .select('id, student_id, period_label, expires_at, student:students!inner(name)')
    .eq('token', token)
    .single()

  if (error || !tokenRow) {
    return NextResponse.json({ error: 'トークンが無効です' }, { status: 404 })
  }

  // Check expiry
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: '回答期限が過ぎています' }, { status: 410 })
  }

  // Check if already submitted
  const { data: existing } = await admin
    .from('mendan_requests')
    .select('id')
    .eq('token_id', tokenRow.id)
    .limit(1)

  const { data: settings } = await admin
    .from('school_settings')
    .select('school_name')
    .limit(1)
    .single()

  return NextResponse.json({
    data: {
      student_name: (tokenRow.student as unknown as { name: string }).name,
      period_label: tokenRow.period_label,
      school_name: settings?.school_name || 'レフィー',
      already_submitted: !!existing?.length,
    },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: tokenRow, error } = await admin
    .from('mendan_tokens')
    .select('id, student_id, expires_at')
    .eq('token', token)
    .single()

  if (error || !tokenRow) {
    return NextResponse.json({ error: 'トークンが無効です' }, { status: 404 })
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: '回答期限が過ぎています' }, { status: 410 })
  }

  // Check if already submitted
  const { data: existing } = await admin
    .from('mendan_requests')
    .select('id')
    .eq('token_id', tokenRow.id)
    .limit(1)

  if (existing?.length) {
    return NextResponse.json({ error: '既に回答済みです' }, { status: 409 })
  }

  const body = await request.json()
  const { candidate1, candidate2, candidate3, message } = body

  if (!candidate1 || !candidate2 || !candidate3) {
    return NextResponse.json({ error: '3つの希望日時を入力してください' }, { status: 400 })
  }

  const { error: insertError } = await admin
    .from('mendan_requests')
    .insert({
      token_id: tokenRow.id,
      student_id: tokenRow.student_id,
      candidate1,
      candidate2,
      candidate3,
      message: message || null,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true } }, { status: 201 })
}

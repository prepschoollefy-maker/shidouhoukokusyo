import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMendanEmails } from '@/lib/mendan/send-mendan-emails'

// プレビュー: 送信対象の生徒一覧を返す
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const periodLabel = request.nextUrl.searchParams.get('period_label') || ''
  const admin = createAdminClient()

  // Get active students with parent emails
  const { data: students } = await admin
    .from('students')
    .select('id, name, parent_emails(email)')
    .eq('status', 'active')
    .order('name')

  if (!students?.length) {
    return NextResponse.json({ data: [] })
  }

  // Check which students already have tokens for this period
  let sentStudentIds: Set<string> = new Set()
  if (periodLabel) {
    const { data: existingTokens } = await admin
      .from('mendan_tokens')
      .select('student_id')
      .eq('period_label', periodLabel)

    sentStudentIds = new Set((existingTokens || []).map(t => t.student_id))
  }

  const preview = students.map(s => {
    const emails = (s.parent_emails as { email: string }[]) || []
    return {
      id: s.id,
      name: s.name,
      has_email: emails.length > 0,
      already_sent: sentStudentIds.has(s.id),
    }
  })

  return NextResponse.json({ data: preview })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { period_label, custom_body, student_ids, deadline } = body

  if (!period_label) {
    return NextResponse.json({ error: '期間ラベルを入力してください' }, { status: 400 })
  }

  const result = await sendMendanEmails(
    period_label,
    custom_body || undefined,
    student_ids?.length ? student_ids : undefined,
    deadline || undefined,
  )
  return NextResponse.json({ data: result })
}

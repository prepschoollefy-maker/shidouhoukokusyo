import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { summary_id } = body

  const admin = createAdminClient()

  // Get summary with student info
  const { data: summary } = await admin
    .from('summaries')
    .select(`
      *,
      student:students!inner(id, name)
    `)
    .eq('id', summary_id)
    .single()

  if (!summary) {
    return NextResponse.json({ error: 'Summary not found' }, { status: 404 })
  }

  // Get parent emails
  const { data: parentEmails } = await admin
    .from('parent_emails')
    .select('email')
    .eq('student_id', summary.student_id)

  if (!parentEmails?.length) {
    return NextResponse.json({ error: '保護者メールアドレスが登録されていません' }, { status: 400 })
  }

  // Get school settings for signature
  const { data: settings } = await admin
    .from('school_settings')
    .select('school_name, email_signature')
    .limit(1)
    .single()

  const periodStart = summary.period_start
  const periodEnd = summary.period_end
  const emailSubject = `【${settings?.school_name || 'レフィー'}】${summary.student.name}さんの学習レポート`
  const emailBody = `${summary.content}\n\n${settings?.email_signature || ''}`

  const errors: string[] = []
  for (const pe of parentEmails) {
    try {
      await sendEmail({
        to: pe.email,
        subject: emailSubject,
        text: emailBody,
      })

      await admin.from('email_logs').insert({
        summary_id,
        student_id: summary.student_id,
        to_email: pe.email,
        subject: emailSubject,
        body: emailBody,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`${pe.email}: ${msg}`)
      await admin.from('email_logs').insert({
        summary_id,
        student_id: summary.student_id,
        to_email: pe.email,
        subject: emailSubject,
        body: emailBody,
        status: 'failed',
        error_message: msg,
      })
    }
  }

  // Update summary status
  await admin.from('summaries').update({ status: 'sent' }).eq('id', summary_id)

  if (errors.length) {
    return NextResponse.json({ data: { partial: true, errors } })
  }
  return NextResponse.json({ data: { success: true } })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend/client'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Find approved summaries with auto_send_at in the past
  const { data: summaries } = await admin
    .from('summaries')
    .select(`
      *,
      student:students!inner(id, name)
    `)
    .eq('status', 'approved')
    .not('auto_send_at', 'is', null)
    .lte('auto_send_at', new Date().toISOString())

  if (!summaries?.length) {
    return NextResponse.json({ data: { sent: 0 } })
  }

  const { data: settings } = await admin
    .from('school_settings')
    .select('school_name, email_signature')
    .limit(1)
    .single()

  let sentCount = 0

  for (const summary of summaries) {
    const { data: parentEmails } = await admin
      .from('parent_emails')
      .select('email')
      .eq('student_id', summary.student_id)

    if (!parentEmails?.length) continue

    const emailSubject = `【${settings?.school_name || 'レフィー'}】${summary.student.name}さんの学習レポート`
    const emailBody = `${summary.content}\n\n${settings?.email_signature || ''}`

    for (const pe of parentEmails) {
      try {
        await sendEmail({ to: pe.email, subject: emailSubject, text: emailBody })
        await admin.from('email_logs').insert({
          summary_id: summary.id,
          student_id: summary.student_id,
          to_email: pe.email,
          subject: emailSubject,
          body: emailBody,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      } catch (error) {
        await admin.from('email_logs').insert({
          summary_id: summary.id,
          student_id: summary.student_id,
          to_email: pe.email,
          subject: emailSubject,
          body: emailBody,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown',
        })
      }
    }

    await admin.from('summaries').update({ status: 'sent' }).eq('id', summary.id)
    sentCount++
  }

  return NextResponse.json({ data: { sent: sentCount } })
}

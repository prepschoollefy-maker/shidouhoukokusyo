import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend/client'
import { buildMendanHtmlEmail } from './email-template'

export async function sendMendanEmails(periodLabel: string, customBody?: string, studentIds?: string[], deadline?: string) {
  const admin = createAdminClient()

  // Get school settings
  const { data: settings } = await admin
    .from('school_settings')
    .select('school_name, email_signature')
    .limit(1)
    .single()

  const schoolName = settings?.school_name || 'レフィー'
  const signature = settings?.email_signature || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shidouhoukokusyo.vercel.app'

  // Get students with parent emails
  let studentQuery = admin
    .from('students')
    .select('id, name, parent_emails(email)')
    .eq('status', 'active')
    .order('name')

  if (studentIds?.length) {
    studentQuery = studentQuery.in('id', studentIds)
  }

  const { data: students } = await studentQuery

  if (!students?.length) {
    return { sent: 0, skipped: 0, errors: [] }
  }

  let sent = 0
  let skipped = 0
  const errors: string[] = []
  const expiresAt = deadline
    ? new Date(deadline + 'T23:59:59+09:00').toISOString()
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  for (const student of students) {
    const parentEmails = (student.parent_emails as { email: string }[]) || []
    if (!parentEmails.length) continue

    // Check if token already exists for this student + period
    const { data: existing } = await admin
      .from('mendan_tokens')
      .select('id, token')
      .eq('student_id', student.id)
      .eq('period_label', periodLabel)
      .limit(1)

    // 明示的に生徒が指定されていない場合、送信済みはスキップ
    if (existing?.length && !studentIds?.length) {
      skipped++
      continue
    }

    let token: string

    if (existing?.length) {
      // 既存トークンを再利用して再送
      token = existing[0].token
    } else {
      // Create new token
      const { data: tokenRow, error: tokenError } = await admin
        .from('mendan_tokens')
        .insert({
          student_id: student.id,
          period_label: periodLabel,
          expires_at: expiresAt,
        })
        .select('token')
        .single()

      if (tokenError || !tokenRow) {
        errors.push(`${student.name}: トークン生成失敗`)
        continue
      }
      token = tokenRow.token
    }

    const requestUrl = `${appUrl}/mendan/request/${token}`
    const emailSubject = `【${schoolName}】${student.name}さんの面談日程のご案内`

    let emailText: string
    if (customBody) {
      const replacedBody = customBody
        .replace(/\{生徒名\}/g, student.name)
        .replace(/\{期間\}/g, periodLabel)
      emailText = `${replacedBody}\n\n下記URLより面談のご希望日時を3つお選びください。\n${requestUrl}\n\n回答期限: ${new Date(expiresAt).toLocaleDateString('ja-JP')}\n\n${signature}`
    } else {
      emailText = `${student.name}さんの${periodLabel}の面談日程についてご案内いたします。\n\n下記URLより面談のご希望日時を3つお選びください。\n${requestUrl}\n\n回答期限: ${new Date(expiresAt).toLocaleDateString('ja-JP')}\n\n${signature}`
    }

    const emailHtml = buildMendanHtmlEmail(
      student.name, periodLabel, requestUrl, expiresAt, schoolName, signature, customBody
    )

    for (const pe of parentEmails) {
      try {
        await sendEmail({
          to: pe.email,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        })

        await admin.from('email_logs').insert({
          summary_id: null,
          student_id: student.id,
          to_email: pe.email,
          subject: emailSubject,
          body: emailText,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })

        sent++
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${student.name} (${pe.email}): ${msg}`)
        await admin.from('email_logs').insert({
          summary_id: null,
          student_id: student.id,
          to_email: pe.email,
          subject: emailSubject,
          body: emailText,
          status: 'failed',
          error_message: msg,
        })
      }
    }
  }

  return { sent, skipped, errors }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend/client'

function buildHtmlEmail(
  studentName: string,
  content: string,
  viewUrl: string,
  schoolName: string,
  signature: string
): string {
  // Convert 【section】 headers and newlines to HTML
  const htmlContent = content
    .replace(/【([^】]+)】/g, '<h2 style="font-size:16px;font-weight:bold;color:#1a1a2e;margin:24px 0 8px 0;padding-bottom:6px;border-bottom:2px solid #e8eaf0;">$1</h2>')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#3b82f6);border-radius:12px 12px 0 0;padding:24px 28px;">
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">${schoolName}</p>
      <h1 style="margin:6px 0 0;font-size:20px;color:#fff;font-weight:bold;">${studentName}さんの学習レポート</h1>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="font-size:14px;line-height:1.8;color:#333;">
        ${htmlContent}
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0 16px;">
        <a href="${viewUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:bold;">
          Webでレポートを見る
        </a>
      </div>
      <p style="text-align:center;font-size:12px;color:#999;margin:0;">上のボタンが表示されない場合: <a href="${viewUrl}" style="color:#4f46e5;">${viewUrl}</a></p>
    </div>

    <!-- Footer -->
    <div style="padding:20px;text-align:center;">
      <p style="font-size:12px;color:#999;white-space:pre-wrap;margin:0;">${signature}</p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { summary_id } = body

  const admin = createAdminClient()

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

  const { data: parentEmails } = await admin
    .from('parent_emails')
    .select('email')
    .eq('student_id', summary.student_id)

  if (!parentEmails?.length) {
    return NextResponse.json({ error: '保護者メールアドレスが登録されていません' }, { status: 400 })
  }

  const { data: settings } = await admin
    .from('school_settings')
    .select('school_name, email_signature')
    .limit(1)
    .single()

  const schoolName = settings?.school_name || 'レフィー'
  const signature = settings?.email_signature || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shidouhoukokusyo.vercel.app'
  const viewUrl = `${appUrl}/view/${summary.view_token}`

  const emailSubject = `【${schoolName}】${summary.student.name}さんの学習レポート`
  const emailText = `${summary.student.name}さんの学習レポート\n\n${summary.content}\n\nWebで見る: ${viewUrl}\n\n${signature}`
  const emailHtml = buildHtmlEmail(summary.student.name, summary.content, viewUrl, schoolName, signature)

  const errors: string[] = []
  for (const pe of parentEmails) {
    try {
      await sendEmail({
        to: pe.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      })

      await admin.from('email_logs').insert({
        summary_id,
        student_id: summary.student_id,
        to_email: pe.email,
        subject: emailSubject,
        body: emailText,
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
        body: emailText,
        status: 'failed',
        error_message: msg,
      })
    }
  }

  await admin.from('summaries').update({ status: 'sent' }).eq('id', summary_id)

  if (errors.length) {
    return NextResponse.json({ data: { partial: true, errors } })
  }
  return NextResponse.json({ data: { success: true } })
}

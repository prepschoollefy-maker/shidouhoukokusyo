import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend/client'

// セクションタイトルに応じたテーマカラー
const sectionColorMap: [RegExp, string, string][] = [
  [/学習(内容|進捗)/, '#3b82f6', '#eff6ff'],  // blue
  [/理解度|理解/, '#10b981', '#ecfdf5'],        // emerald
  [/様子/, '#f59e0b', '#fffbeb'],              // amber
  [/方針|家庭|お願い/, '#8b5cf6', '#f5f3ff'],  // purple
  [/宿題|次回/, '#6366f1', '#eef2ff'],         // indigo
]

function getSectionColors(title: string): { accent: string; bg: string } {
  for (const [pattern, accent, bg] of sectionColorMap) {
    if (pattern.test(title)) return { accent, bg }
  }
  return { accent: '#64748b', bg: '#f8fafc' }
}

function buildHtmlEmail(
  studentName: string,
  content: string,
  viewUrl: string,
  schoolName: string,
  signature: string
): string {
  // Clean markdown artifacts and convert to HTML
  let cleaned = content
    .replace(/^#{1,6}\s*/gm, '')     // strip ## headings
    .replace(/^---+$/gm, '')          // strip ---
    .replace(/^\*{3,}$/gm, '')        // strip ***
    .replace(/\n{3,}/g, '\n\n')       // collapse excess newlines

  // Convert 【section】 to styled blocks with color coding
  cleaned = cleaned.replace(/【([^】]+)】([\s\S]*?)(?=【|$)/g, (_match, title: string, body: string) => {
    const { accent, bg } = getSectionColors(title)
    const bodyHtml = body.trim()
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/「([^」]+)」/g, '<strong style="color:#1e293b;">「$1」</strong>')
      .replace(/\n/g, '<br>')
    return `
      <div style="margin:20px 0;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
        <div style="background:${bg};padding:10px 16px;border-left:4px solid ${accent};">
          <h2 style="margin:0;font-size:15px;font-weight:bold;color:${accent};">${title}</h2>
        </div>
        <div style="padding:14px 16px;font-size:14px;line-height:1.9;color:#374151;">
          ${bodyHtml}
        </div>
      </div>`
  })

  // Handle any remaining content not inside sections
  if (!cleaned.includes('<div style="margin:20px')) {
    cleaned = cleaned
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/「([^」]+)」/g, '<strong style="color:#1e293b;">「$1」</strong>')
      .replace(/\n/g, '<br>')
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Hiragino Kaku Gothic ProN',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#3b82f6);border-radius:16px 16px 0 0;padding:28px 28px 24px;">
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);letter-spacing:0.5px;">${schoolName}</p>
      <h1 style="margin:8px 0 0;font-size:20px;color:#fff;font-weight:bold;line-height:1.4;">${studentName}さんの学習レポート</h1>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:24px 20px;border-radius:0 0 16px 16px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
      ${cleaned}

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0 16px;">
        <a href="${viewUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#3b82f6);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:bold;box-shadow:0 2px 8px rgba(79,70,229,0.3);">
          Webでレポートを見る
        </a>
      </div>
      <p style="text-align:center;font-size:11px;color:#9ca3af;margin:0;">上のボタンが表示されない場合: <a href="${viewUrl}" style="color:#4f46e5;text-decoration:none;">${viewUrl}</a></p>
    </div>

    <!-- Footer -->
    <div style="padding:24px 20px;text-align:center;">
      <p style="font-size:12px;color:#9ca3af;white-space:pre-wrap;margin:0;line-height:1.6;">${signature}</p>
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lefy-platform.vercel.app'
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

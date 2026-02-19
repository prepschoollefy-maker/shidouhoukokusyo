import { Resend } from 'resend'

let resendClient: Resend | null = null

export function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY!)
  }
  return resendClient
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string | string[]
  subject: string
  text: string
  html?: string
}) {
  const resend = getResendClient()
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@example.com'

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    ...(html ? { html } : {}),
  })

  if (error) {
    throw new Error(`メール送信に失敗しました: ${error.message}`)
  }

  return data
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMendanEmails } from '@/lib/mendan/send-mendan-emails'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: settings } = await admin
    .from('school_settings')
    .select('mendan_auto_send_enabled, mendan_auto_send_day, mendan_auto_send_hour')
    .limit(1)
    .single()

  if (!settings?.mendan_auto_send_enabled) {
    return NextResponse.json({ data: { skipped: true, reason: 'auto_send_disabled' } })
  }

  // Check if today matches the configured day and hour (JST)
  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const dayJST = nowJST.getUTCDate()
  const hourJST = nowJST.getUTCHours()

  if (dayJST !== settings.mendan_auto_send_day || hourJST !== settings.mendan_auto_send_hour) {
    return NextResponse.json({ data: { skipped: true, reason: 'not_scheduled_time' } })
  }

  const periodLabel = `${nowJST.getUTCFullYear()}年${nowJST.getUTCMonth() + 1}月`
  const result = await sendMendanEmails(periodLabel)
  return NextResponse.json({ data: result })
}

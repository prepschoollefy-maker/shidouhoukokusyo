import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || '（未設定）'

  const defaultBody = `保護者様

{生徒名}さんの{期間}の面談日程についてご案内いたします。

下記のボタンより、面談のご希望日時を3つお選びください。`

  return NextResponse.json({
    data: {
      from_email: fromEmail,
      default_body: defaultBody,
      variables: [
        { key: '{生徒名}', description: '生徒の名前に置換されます' },
        { key: '{期間}', description: '期間ラベル（例：2026年3月）に置換されます' },
      ],
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 簡易レート制限: IP単位で1分間に5回まで
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }

  entry.count++
  return entry.count > 5
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'しばらく時間をおいてから再度お試しください' }, { status: 429 })
  }

  const body = await request.json()
  const { email, password, display_name } = body

  if (!email || !password || !display_name?.trim()) {
    return NextResponse.json({ error: '全ての項目を入力してください' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'パスワードは6文字以上で入力してください' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: display_name.trim(),
      role: 'teacher',
    },
  })

  if (createError) {
    if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
      return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 })
    }
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  return NextResponse.json({ data: { id: newUser.user.id } }, { status: 201 })
}

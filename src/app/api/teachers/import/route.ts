import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows } = await request.json()
  if (!rows?.length) {
    return NextResponse.json({ error: 'データがありません' }, { status: 400 })
  }

  const admin = createAdminClient()
  let count = 0
  const errors: string[] = []

  for (const row of rows) {
    const email = row['メール'] || row['email']
    const displayName = row['名前'] || row['display_name'] || row['name']
    const password = row['パスワード'] || row['password'] || Math.random().toString(36).slice(-8)

    if (!email || !displayName) continue

    const { data: newUser, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        role: 'teacher',
      },
    })

    if (error) {
      const msg = (error.message.includes('already been registered') || error.message.includes('already exists'))
        ? '既に登録されています'
        : error.message
      errors.push(`${email}: ${msg}`)
      continue
    }

    // Save initial password to profile for admin reference
    if (newUser?.user) {
      await admin
        .from('profiles')
        .update({ initial_password: password })
        .eq('id', newUser.user.id)
    }

    count++
  }

  return NextResponse.json({ count, errors: errors.length ? errors : undefined })
}

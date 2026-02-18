import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const names = rows
    .map((r: Record<string, string>) => r['テキスト名'] || r['name'] || '')
    .filter(Boolean)

  if (!names.length) {
    return NextResponse.json({ error: 'テキスト名が見つかりません' }, { status: 400 })
  }

  const { error } = await supabase
    .from('textbook_suggestions')
    .insert(names.map((name: string) => ({ name })))

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: names.length })
}

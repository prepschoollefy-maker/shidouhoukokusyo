import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** 学年の進級マッピング */
const GRADE_UP_MAP: Record<string, string> = {
  '小3': '小4',
  '小4': '小5',
  '小5': '小6',
  '小6': '中1',
  '中1': '中2',
  '中2': '中3',
  '中3': '高1',
  '高1': '高2',
  '高2': '高3',
  // 高3・浪人は進級なし
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 日本時間で4月1日かチェック
  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const month = jst.getMonth() + 1
  const day = jst.getDate()

  if (month !== 4 || day !== 1) {
    return NextResponse.json({ message: '4月1日ではないためスキップ', skipped: true })
  }

  const admin = createAdminClient()

  // 通塾中の生徒で学年が設定されているものを取得
  const { data: students, error } = await admin
    .from('students')
    .select('id, grade')
    .eq('status', 'active')
    .not('grade', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let count = 0
  for (const s of students || []) {
    const nextGrade = GRADE_UP_MAP[s.grade]
    if (!nextGrade) continue

    const { error: updateError } = await admin
      .from('students')
      .update({ grade: nextGrade })
      .eq('id', s.id)

    if (!updateError) count++
  }

  return NextResponse.json({ message: `${count}人の学年を更新しました`, count })
}

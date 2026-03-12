import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
}

async function downloadCsv(cookieHeader: string, year: number, month: number): Promise<string> {
  const url = `https://comiru.jp/lefy/seat/download/csv?year=${year}&month=${month}&include_without_student_coma=0`
  const res = await fetch(url, {
    headers: { ...BROWSER_HEADERS, 'Cookie': cookieHeader },
  })
  if (!res.ok) throw new Error(`CSV取得失敗 (status: ${res.status}, ${year}/${month})`)

  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  // BOM判定: UTF-8 BOM (EF BB BF) ならUTF-8、それ以外はShift-JIS
  let text: string
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    text = new TextDecoder('utf-8').decode(buf)
  } else {
    text = new TextDecoder('shift-jis').decode(buf)
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  return text
}

interface Lesson {
  teacher_name: string
  lesson_date: string
  start_time: string
  end_time: string
  student_name: string | null
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current.trim())
  return result
}

function parseCsv(text: string): Lesson[] {
  const lines = text.split('\n').filter(l => l.trim())
  const lessons: Lesson[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 6) continue
    const dateStr = cols[1]?.trim()
    const teacherName = cols[3]?.trim()
    const startTime = cols[4]?.trim()
    const endTime = cols[5]?.trim()
    const studentName = cols[11]?.trim() || null
    const absent = cols[17]?.trim()       // R列: 欠席
    const noReschedule = cols[19]?.trim()  // T列: 振替不可
    // 欠席or振替不可=1 → 実施しない授業なので除外
    if (absent === '1' || noReschedule === '1') continue
    if (!dateStr || !teacherName || !startTime || !endTime) continue
    lessons.push({
      teacher_name: teacherName,
      lesson_date: dateStr.replace(/\//g, '-'),
      start_time: startTime + ':00',
      end_time: endTime + ':00',
      student_name: studentName,
    })
  }
  return lessons
}

export async function POST(request: NextRequest) {
  // 管理者認証
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { period_id, cookies: comiruCookies } = body

  if (!period_id || !comiruCookies) {
    return NextResponse.json({ error: 'period_id and cookies required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 期間の日付範囲を取得
  const { data: period } = await admin
    .from('lecture_scheduling_periods')
    .select('start_date, end_date')
    .eq('id', period_id)
    .single()

  if (!period) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  }

  // 期間がカバーする月を算出
  const startDate = new Date(period.start_date + 'T00:00:00')
  const endDate = new Date(period.end_date + 'T00:00:00')
  const months: { year: number; month: number }[] = []
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  while (current <= endDate) {
    months.push({ year: current.getFullYear(), month: current.getMonth() + 1 })
    current.setMonth(current.getMonth() + 1)
  }

  try {
    const cookieHeader = (comiruCookies as string[]).join('; ')

    // CSV取得（GETリクエスト - Vercelからブロックされない）
    let allLessons: Lesson[] = []
    for (const { year, month } of months) {
      const csv = await downloadCsv(cookieHeader, year, month)
      allLessons.push(...parseCsv(csv))
    }

    // 期間の日付範囲でフィルタ & 重複除去
    const seen = new Set<string>()
    allLessons = allLessons.filter(l => {
      if (l.lesson_date < period.start_date || l.lesson_date > period.end_date) return false
      const key = `${l.teacher_name}|${l.lesson_date}|${l.start_time}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // 既存データを削除（期間内のみ）
    await admin
      .from('comiru_lessons')
      .delete()
      .gte('lesson_date', period.start_date)
      .lte('lesson_date', period.end_date)

    // 新しいデータを挿入（バッチ）
    if (allLessons.length > 0) {
      const now = new Date().toISOString()
      const rows = allLessons.map(l => ({ ...l, synced_at: now }))
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500)
        const { error } = await admin
          .from('comiru_lessons')
          .upsert(batch, { onConflict: 'teacher_name,lesson_date,start_time' })
        if (error) throw error
      }
    }

    return NextResponse.json({ success: true, count: allLessons.length })
  } catch (err) {
    console.error('comiru sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'comiru同期エラー' },
      { status: 500 }
    )
  }
}

/**
 * Comiru HTTP Client
 * comiruにHTTPでログインし、座席一覧CSVをダウンロード・パースする
 */

interface ComiruLesson {
  teacher_name: string
  lesson_date: string  // YYYY-MM-DD
  start_time: string   // HH:MM
  end_time: string     // HH:MM
}

interface ComiruCookies {
  phpsessid: string
  login: string
  cfCookies: string[]
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

/** Set-Cookieヘッダーから全cookieを抽出 */
function extractCookies(res: Response): string[] {
  const cookies: string[] = []
  // getSetCookie() で個別取得
  const setCookies = res.headers.getSetCookie?.() || []
  for (const c of setCookies) {
    const nameVal = c.split(';')[0]
    if (nameVal) cookies.push(nameVal)
  }
  // fallback
  if (cookies.length === 0) {
    const raw = res.headers.get('set-cookie') || ''
    for (const part of raw.split(/,(?=\s*\w+=)/)) {
      const nameVal = part.split(';')[0].trim()
      if (nameVal) cookies.push(nameVal)
    }
  }
  return cookies
}

/** cookie配列を結合してヘッダー文字列に */
function buildCookieHeader(cookieJar: string[]): string {
  return cookieJar.join('; ')
}

/** cookie jarにマージ（同名は上書き） */
function mergeCookies(jar: string[], newCookies: string[]): string[] {
  const map = new Map<string, string>()
  for (const c of [...jar, ...newCookies]) {
    const eqIdx = c.indexOf('=')
    if (eqIdx > 0) {
      const name = c.substring(0, eqIdx)
      map.set(name, c)
    }
  }
  return Array.from(map.values())
}

/** ログインページからCSRFトークンを取得 */
async function getLoginPage(): Promise<{ csrf: string; cookieJar: string[] }> {
  const res = await fetch('https://comiru.jp/teachers/login', {
    headers: BROWSER_HEADERS,
    redirect: 'manual',
  })

  // リダイレクトをフォロー（Cloudflareチャレンジ対応）
  let html: string
  let cookieJar = extractCookies(res)
  // ログインページのJSが document.cookie = 'platform=Win32' をセットする
  cookieJar.push('platform=Win32')

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    if (location) {
      const url = location.startsWith('http') ? location : `https://comiru.jp${location}`
      const res2 = await fetch(url, {
        headers: { ...BROWSER_HEADERS, 'Cookie': buildCookieHeader(cookieJar) },
        redirect: 'manual',
      })
      cookieJar = mergeCookies(cookieJar, extractCookies(res2))
      html = await res2.text()
    } else {
      html = await res.text()
    }
  } else {
    html = await res.text()
  }

  // CSRFトークン
  const csrfMatch = html.match(/name="_csrf_token"\s+value="([^"]+)"/)
  if (!csrfMatch) {
    // デバッグ: レスポンスの冒頭を含める
    const preview = html.substring(0, 500)
    throw new Error(`CSRFトークンが見つかりません (status: ${res.status}, body: ${preview})`)
  }

  return { csrf: csrfMatch[1], cookieJar }
}

/** ログイン実行 */
async function login(email: string, password: string): Promise<ComiruCookies> {
  const { csrf, cookieJar } = await getLoginPage()

  const body = new URLSearchParams({
    email,
    password,
    _csrf_token: csrf,
  })

  const res = await fetch('https://comiru.jp/teachers/login', {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': buildCookieHeader(cookieJar),
      'Origin': 'https://comiru.jp',
      'Referer': 'https://comiru.jp/teachers/login',
    },
    body: body.toString(),
    redirect: 'manual',
  })

  // 302リダイレクト = 成功
  if (res.status !== 302) {
    const body = await res.text()
    console.error('comiru login failed:', { status: res.status, body: body.substring(0, 1000) })
    throw new Error(`comiruログイン失敗 (status: ${res.status})`)
  }

  const newCookies = extractCookies(res)
  const allCookies = mergeCookies(cookieJar, newCookies)

  // PHPSESSIDと_loginを抽出
  let phpsessid = ''
  let loginCookie = '1'
  for (const c of allCookies) {
    const pm = c.match(/^PHPSESSID=(.+)/)
    if (pm) phpsessid = pm[1]
    const lm = c.match(/^_login=(.+)/)
    if (lm) loginCookie = lm[1]
  }

  if (!phpsessid) throw new Error('セッションCookieが取得できません')

  return { phpsessid, login: loginCookie, cfCookies: allCookies }
}

/** 座席一覧CSVをダウンロード */
async function downloadSeatCsv(
  cookies: ComiruCookies,
  schoolSlug: string,
  year: number,
  month: number,
): Promise<string> {
  const url = `https://comiru.jp/${schoolSlug}/seat/download/csv?year=${year}&month=${month}&include_without_student_coma=0`
  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      'Cookie': buildCookieHeader(cookies.cfCookies),
      'Referer': `https://comiru.jp/${schoolSlug}/seat/index`,
    },
  })

  if (!res.ok) {
    throw new Error(`CSV取得失敗 (status: ${res.status}, month: ${year}/${month})`)
  }

  const buffer = await res.arrayBuffer()
  // UTF-8 BOM付きで返ってくる
  let text = new TextDecoder('utf-8').decode(buffer)
  // BOM除去
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1)
  }
  return text
}

/** CSVテキストをパースしてレッスン配列に変換 */
function parseSeatCsv(csvText: string): ComiruLesson[] {
  const lines = csvText.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const lessons: ComiruLesson[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    // columns: 教室ID,日付,講師,講師名,開始時間,終了時間,...
    if (cols.length < 6) continue

    const dateStr = cols[1]   // 2026/03/01
    const teacherName = cols[3]
    const startTime = cols[4] // 12:30
    const endTime = cols[5]   // 13:50

    if (!dateStr || !teacherName || !startTime || !endTime) continue

    // 日付フォーマット変換: 2026/03/01 → 2026-03-01
    const lessonDate = dateStr.replace(/\//g, '-')

    lessons.push({
      teacher_name: teacherName,
      lesson_date: lessonDate,
      start_time: startTime,
      end_time: endTime,
    })
  }

  return lessons
}

/** CSV行をパース（ダブルクォート対応） */
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

/**
 * comiruから指定月のレッスンデータを取得
 * @param months 取得する年月の配列 (例: [{year:2026, month:3}, {year:2026, month:4}])
 */
export async function fetchComiruLessons(
  months: { year: number; month: number }[],
): Promise<ComiruLesson[]> {
  const email = process.env.COMIRU_EMAIL
  const password = process.env.COMIRU_PASSWORD
  const schoolSlug = 'lefy'

  if (!email || !password) {
    throw new Error('COMIRU_EMAIL/COMIRU_PASSWORD が設定されていません')
  }

  // ログイン
  const cookies = await login(email, password)

  // 教室トップにアクセス（セッション確立のため）
  await fetch(`https://comiru.jp/${schoolSlug}/top`, {
    headers: {
      ...BROWSER_HEADERS,
      'Cookie': buildCookieHeader(cookies.cfCookies),
      'Referer': 'https://comiru.jp/teachers/my/top',
    },
  })

  // 各月のCSVをダウンロード
  const allLessons: ComiruLesson[] = []
  for (const { year, month } of months) {
    const csvText = await downloadSeatCsv(cookies, schoolSlug, year, month)
    const lessons = parseSeatCsv(csvText)
    allLessons.push(...lessons)
  }

  // 重複除去（同じ講師・日付・開始時間）
  const seen = new Set<string>()
  return allLessons.filter(l => {
    const key = `${l.teacher_name}|${l.lesson_date}|${l.start_time}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

import { NextRequest, NextResponse } from 'next/server'

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || ''

/**
 * 契約関連APIのパスワード検証。
 * GETはクエリパラメータ pw、POST/PUT/DELETEはヘッダー x-dashboard-pw で受け取る。
 * パスワード未設定(env空)の場合はスキップ。
 */
export function verifyContractPassword(request: NextRequest): NextResponse | null {
  if (!DASHBOARD_PASSWORD) return null

  const pw =
    request.nextUrl.searchParams.get('pw') ||
    request.headers.get('x-dashboard-pw') ||
    ''

  if (pw !== DASHBOARD_PASSWORD) {
    return NextResponse.json(
      { error: 'ダッシュボードのパスワードが正しくありません' },
      { status: 403 }
    )
  }
  return null
}

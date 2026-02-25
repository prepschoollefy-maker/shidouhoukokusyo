'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboardAuth } from '@/hooks/use-dashboard-auth'

interface MonthData {
  year: number
  month: number
  revenue: number
  count: number
}

export default function ContractDashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [months, setMonths] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(false)

  // パスワード認証（共通フック）
  const { authenticated, password, setPassword, storedPw, verifying, initializing, handleAuth: authHandler } = useDashboardAuth()

  const handleAuth = () => authHandler(`/api/contracts/summary?year=${year}&month=${month}`)

  useEffect(() => {
    if (!authenticated || initializing) return
    const fetchSummary = async () => {
      setLoading(true)
      const res = await fetch(`/api/contracts/summary?year=${year}&month=${month}&pw=${encodeURIComponent(storedPw)}`)
      if (res.ok) {
        const json = await res.json()
        setMonths(json.data || [])
      }
      setLoading(false)
    }
    fetchSummary()
  }, [year, month, authenticated, initializing, storedPw])

  // 初期化中またはパスワード入力画面
  if (initializing) return <LoadingSpinner />
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-bold">経営ダッシュボード</h2>
              <p className="text-sm text-muted-foreground text-center">閲覧にはパスワードが必要です</p>
            </div>
            <div className="space-y-2">
              <Label>パスワード</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAuth() }}
                autoFocus
              />
            </div>
            <Button className="w-full" onClick={handleAuth} disabled={verifying}>
              {verifying ? '確認中...' : 'ログイン'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatYen = (n: number) => `¥${n.toLocaleString()}`
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)

  // 当月データ（配列の最後）
  const current = months.length > 0 ? months[months.length - 1] : null
  const currentRevenue = current?.revenue || 0
  const currentCount = current?.count || 0
  const avgMonthly = currentCount > 0 ? Math.floor(currentRevenue / currentCount) : 0

  // グラフの最大値
  const maxRevenue = Math.max(...months.map(m => m.revenue), 1)

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">経営ダッシュボード</h2>
        <div className="flex gap-2 items-center">
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m} value={String(m)}>{m}月</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">当月売上</div>
            <div className="text-3xl font-bold mt-1">{formatYen(currentRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">生徒数</div>
            <div className="text-3xl font-bold mt-1">{currentCount}<span className="text-lg ml-1">人</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">平均月謝</div>
            <div className="text-3xl font-bold mt-1">{formatYen(avgMonthly)}</div>
          </CardContent>
        </Card>
      </div>

      {/* 月別売上推移グラフ */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">月別売上推移（12ヶ月）</h3>
          {(() => {
            // Y軸の目盛り計算（きりのいい数値で4段階）
            const rawMax = Math.max(...months.map(m => m.revenue), 1)
            const step = rawMax <= 500000 ? 100000
              : rawMax <= 1000000 ? 200000
              : rawMax <= 2000000 ? 500000
              : rawMax <= 5000000 ? 1000000
              : 2000000
            const gridMax = Math.ceil(rawMax / step) * step
            const gridLines = Array.from({ length: Math.ceil(gridMax / step) + 1 }, (_, i) => i * step)
            const chartHeight = 220

            const formatAmount = (n: number) => {
              if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`
              return n.toLocaleString()
            }

            return (
              <div className="flex">
                {/* Y軸ラベル */}
                <div className="flex flex-col justify-between pr-2 text-right" style={{ height: `${chartHeight}px`, width: '48px' }}>
                  {[...gridLines].reverse().map((v, i) => (
                    <div key={i} className="text-xs text-muted-foreground leading-none whitespace-nowrap">
                      {formatAmount(v)}
                    </div>
                  ))}
                </div>
                {/* グラフ本体 */}
                <div className="flex-1 relative" style={{ height: `${chartHeight}px` }}>
                  {/* グリッドライン */}
                  {gridLines.map((v, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-gray-200"
                      style={{ bottom: `${(v / gridMax) * 100}%` }}
                    />
                  ))}
                  {/* バー */}
                  <div className="absolute inset-0 flex items-end gap-1 px-1">
                    {months.map((m, i) => {
                      const barH = gridMax > 0 ? (m.revenue / gridMax) * chartHeight : 0
                      const isCurrent = i === months.length - 1
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                          {/* ホバー時の詳細ツールチップ */}
                          <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                            <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                              <div>¥{m.revenue.toLocaleString()}</div>
                              <div>{m.count}人</div>
                            </div>
                          </div>
                          {/* 金額ラベル（当月のみ常時表示） */}
                          {isCurrent && m.revenue > 0 && (
                            <div className="text-xs font-semibold text-blue-600 mb-1 whitespace-nowrap">
                              ¥{m.revenue.toLocaleString()}
                            </div>
                          )}
                          {/* バー */}
                          <div
                            className={`w-full max-w-[40px] rounded-t transition-all ${
                              isCurrent ? 'bg-blue-500' : 'bg-blue-300 hover:bg-blue-400'
                            }`}
                            style={{ height: `${Math.max(barH, m.revenue > 0 ? 4 : 2)}px` }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
          {/* X軸ラベル + 生徒数 */}
          <div className="flex mt-1" style={{ marginLeft: '48px' }}>
            <div className="flex-1 flex gap-1 px-1">
              {months.map((m, i) => {
                const isCurrent = i === months.length - 1
                return (
                  <div key={i} className="flex-1 text-center">
                    <div className={`text-xs ${isCurrent ? 'font-bold text-blue-600' : 'text-muted-foreground'}`}>
                      {m.month}月
                    </div>
                    <div className={`text-xs mt-0.5 ${isCurrent ? 'font-semibold' : 'text-muted-foreground'}`}>
                      {m.count}人
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 月別詳細テーブル */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">月別詳細</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">月</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">売上</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">生徒数</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">平均月謝</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">前月比</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => {
                  const prev = i > 0 ? months[i - 1] : null
                  const diff = prev ? m.revenue - prev.revenue : 0
                  const avg = m.count > 0 ? Math.floor(m.revenue / m.count) : 0
                  const isCurrent = i === months.length - 1
                  return (
                    <tr key={i} className={`border-b last:border-b-0 ${isCurrent ? 'bg-blue-50' : ''}`}>
                      <td className={`py-2 px-2 ${isCurrent ? 'font-bold' : ''}`}>{m.year}/{m.month}月</td>
                      <td className="py-2 px-2 text-right font-medium">¥{m.revenue.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right">{m.count}人</td>
                      <td className="py-2 px-2 text-right">¥{avg.toLocaleString()}</td>
                      <td className={`py-2 px-2 text-right ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : ''}`}>
                        {prev ? (diff > 0 ? '+' : '') + `¥${diff.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

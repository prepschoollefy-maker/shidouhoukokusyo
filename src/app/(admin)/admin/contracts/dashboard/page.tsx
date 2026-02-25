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

  // パスワード認証
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [storedPw, setStoredPw] = useState('')

  const handleAuth = async () => {
    if (!password) { toast.error('パスワードを入力してください'); return }
    setVerifying(true)
    try {
      const res = await fetch(`/api/contracts/summary?year=${year}&month=${month}&pw=${encodeURIComponent(password)}`)
      if (res.status === 403) {
        toast.error('パスワードが正しくありません')
        setVerifying(false)
        return
      }
      if (!res.ok) throw new Error('エラーが発生しました')
      const json = await res.json()
      setMonths(json.data || [])
      setStoredPw(password)
      setAuthenticated(true)
    } catch {
      toast.error('認証に失敗しました')
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    if (!authenticated) return
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
  }, [year, month, authenticated, storedPw])

  // パスワード入力画面
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

      {/* 12ヶ月推移グラフ（CSSのみ） */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">月別売上推移（12ヶ月）</h3>
          <div className="flex items-end gap-1 h-48">
            {months.map((m, i) => {
              const height = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0
              const isCurrent = i === months.length - 1
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: '160px' }}>
                    <div className="text-xs text-muted-foreground mb-1 whitespace-nowrap">
                      {m.revenue > 0 ? `${Math.floor(m.revenue / 10000)}万` : ''}
                    </div>
                    <div
                      className={`w-full rounded-t transition-all ${isCurrent ? 'bg-blue-500' : 'bg-blue-200'}`}
                      style={{ height: `${Math.max(height, 2)}%`, minHeight: m.revenue > 0 ? '4px' : '2px' }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">{m.month}月</div>
                </div>
              )
            })}
          </div>
          {/* 生徒数推移 */}
          <h3 className="text-sm font-medium text-muted-foreground mt-6 mb-2">月別生徒数</h3>
          <div className="flex gap-1">
            {months.map((m, i) => (
              <div key={i} className="flex-1 text-center">
                <div className="text-sm font-medium">{m.count}</div>
                <div className="text-xs text-muted-foreground">{m.month}月</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

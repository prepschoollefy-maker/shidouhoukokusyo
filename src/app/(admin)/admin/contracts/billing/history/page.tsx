'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Lock, ArrowRight, Search } from 'lucide-react'
import { useDashboardAuth } from '@/hooks/use-dashboard-auth'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MonthlyRow {
  year: number
  month: number
  total_billed: number
  total_paid: number
  paid_count: number
  unpaid_count: number
  discrepancy_count: number
  total_items: number
  collection_rate: number
}

interface StudentMonth {
  year: number
  month: number
  billing_type: string
  billed_amount: number
  paid_amount: number
  status: string
}

interface StudentRow {
  student_id: string
  student_name: string
  student_number: string | null
  months: StudentMonth[]
  total_billed: number
  total_paid: number
  outstanding: number
}

type Tab = 'monthly' | 'student'
type StudentFilter = 'all' | 'unpaid' | 'discrepancy'

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BillingHistoryPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [months, setMonths] = useState(12)
  const [tab, setTab] = useState<Tab>('monthly')
  const [loading, setLoading] = useState(false)

  // Monthly data
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([])
  // Student data
  const [studentData, setStudentData] = useState<StudentRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all')

  const { authenticated, password, setPassword, storedPw, verifying, initializing, handleAuth: authHandler } = useDashboardAuth()

  const handleAuth = () => authHandler(`/api/payments/history?view=monthly&year=${year}&months=${months}`)

  const fetchData = useCallback(async (pw: string, currentTab: Tab) => {
    const t = Date.now()
    const params = `view=${currentTab}&year=${year}&months=${months}&pw=${encodeURIComponent(pw)}&_t=${t}`
    const res = await fetch(`/api/payments/history?${params}`)
    if (!res.ok) return
    const json = await res.json()
    if (currentTab === 'monthly') {
      setMonthlyData(json.data || [])
    } else {
      setStudentData(json.data || [])
    }
  }, [year, months])

  useEffect(() => {
    if (!authenticated || initializing) return
    setLoading(true)
    fetchData(storedPw, tab).finally(() => setLoading(false))
  }, [year, months, tab, authenticated, initializing, storedPw, fetchData])

  /* ---- computed ---- */

  const formatYen = (n: number) => `¥${n.toLocaleString()}`

  // Monthly KPIs
  const totalBilled = monthlyData.reduce((s, r) => s + r.total_billed, 0)
  const totalPaid = monthlyData.reduce((s, r) => s + r.total_paid, 0)
  const totalOutstanding = totalBilled - totalPaid
  const overallRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 1000) / 10 : 0

  // Student filtering
  const filteredStudents = studentData.filter(s => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!s.student_name.toLowerCase().includes(q) && !(s.student_number || '').toLowerCase().includes(q)) {
        return false
      }
    }
    if (studentFilter === 'unpaid') return s.outstanding > 0
    if (studentFilter === 'discrepancy') return s.months.some(m => m.status === '過不足あり')
    return true
  })

  // 表示用の月リスト（月別タブの列ヘッダーに使う）
  const displayMonths: { year: number; month: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(year, 11 - i, 1)
    displayMonths.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }

  // 生徒別ビューで月ごとの集約ステータスを計算
  const getStudentMonthStatus = (s: StudentRow, y: number, m: number): string | null => {
    const items = s.months.filter(mi => mi.year === y && mi.month === m)
    if (items.length === 0) return null
    if (items.some(i => i.status === '過不足あり')) return '過不足あり'
    if (items.some(i => i.status === '未入金')) return '未入金'
    return '入金済み'
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const monthsOptions = [3, 6, 12]

  /* ---- auth screen ---- */

  if (initializing) return <LoadingSpinner />
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-bold">入金履歴</h2>
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

  /* ---- main ---- */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">入金履歴</h2>
          <Link href="/admin/contracts/billing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 請求・入金に戻る
          </Link>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}年</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(months)} onValueChange={(v) => setMonths(parseInt(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthsOptions.map(m => <SelectItem key={m} value={String(m)}>直近{m}ヶ月</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === 'monthly' ? 'default' : 'outline'} size="sm" onClick={() => setTab('monthly')}>
          月別サマリー
        </Button>
        <Button variant={tab === 'student' ? 'default' : 'outline'} size="sm" onClick={() => setTab('student')}>
          生徒別
        </Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : tab === 'monthly' ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">総請求額</div>
                <div className="text-2xl font-bold">{formatYen(totalBilled)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">入金済額</div>
                <div className="text-2xl font-bold text-green-600">{formatYen(totalPaid)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">未収額</div>
                <div className="text-2xl font-bold text-red-600">{formatYen(totalOutstanding)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">回収率</div>
                <div className="text-2xl font-bold">{overallRate}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>月</TableHead>
                    <TableHead className="text-right">請求額</TableHead>
                    <TableHead className="text-right">入金額</TableHead>
                    <TableHead className="text-center">済み</TableHead>
                    <TableHead className="text-center">未入金</TableHead>
                    <TableHead className="text-center">過不足</TableHead>
                    <TableHead className="text-center">回収率</TableHead>
                    <TableHead className="text-center w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map(row => {
                    const hasUnpaid = row.unpaid_count > 0
                    return (
                      <TableRow key={`${row.year}-${row.month}`} className={hasUnpaid ? 'bg-red-50/50' : ''}>
                        <TableCell className="font-medium">{row.year}年{row.month}月</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(row.total_billed)}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(row.total_paid)}</TableCell>
                        <TableCell className="text-center text-green-600">{row.paid_count}</TableCell>
                        <TableCell className="text-center">
                          {row.unpaid_count > 0
                            ? <span className="text-red-600 font-medium">{row.unpaid_count}</span>
                            : <span className="text-muted-foreground">0</span>
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          {row.discrepancy_count > 0
                            ? <span className="text-yellow-600 font-medium">{row.discrepancy_count}</span>
                            : <span className="text-muted-foreground">0</span>
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={row.collection_rate < 100 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                            {row.collection_rate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Link href={`/admin/contracts/billing?year=${row.year}&month=${row.month}`}>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {monthlyData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        データがありません
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Student filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 w-56"
                placeholder="生徒名・番号で検索"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {([
                { key: 'all', label: 'すべて' },
                { key: 'unpaid', label: '未入金あり' },
                { key: 'discrepancy', label: '過不足あり' },
              ] as const).map(f => (
                <Button
                  key={f.key}
                  variant={studentFilter === f.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStudentFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Student table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">生徒名</TableHead>
                    {displayMonths.map(dm => (
                      <TableHead key={`${dm.year}-${dm.month}`} className="text-center min-w-[60px]">
                        {dm.month}月
                      </TableHead>
                    ))}
                    <TableHead className="text-right">合計請求</TableHead>
                    <TableHead className="text-right">合計入金</TableHead>
                    <TableHead className="text-right">未収</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map(s => (
                    <TableRow key={s.student_id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium whitespace-nowrap">
                        {s.student_name}
                        {s.student_number && (
                          <span className="text-xs text-muted-foreground ml-1">({s.student_number})</span>
                        )}
                      </TableCell>
                      {displayMonths.map(dm => {
                        const status = getStudentMonthStatus(s, dm.year, dm.month)
                        return (
                          <TableCell key={`${dm.year}-${dm.month}`} className="text-center">
                            {status === null ? (
                              <span className="text-muted-foreground">-</span>
                            ) : status === '入金済み' ? (
                              <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs px-1.5">済</Badge>
                            ) : status === '過不足あり' ? (
                              <Badge variant="default" className="bg-yellow-600 hover:bg-yellow-700 text-xs px-1.5">差</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs px-1.5">未</Badge>
                            )}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right font-mono">{formatYen(s.total_billed)}</TableCell>
                      <TableCell className="text-right font-mono">{formatYen(s.total_paid)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {s.outstanding > 0 ? (
                          <span className="text-red-600 font-medium">{formatYen(s.outstanding)}</span>
                        ) : (
                          <span className="text-muted-foreground">{formatYen(0)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={displayMonths.length + 4} className="text-center text-muted-foreground py-8">
                        該当する生徒がいません
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

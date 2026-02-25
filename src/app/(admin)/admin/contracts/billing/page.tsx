'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'

interface BillingItem {
  id: string
  student_id: string
  grade: string
  courses: { course: string; lessons: number }[]
  monthly_amount: number
  tuition: number
  enrollment_fee_amount: number
  facility_fee: number
  total_amount: number
  start_date: string
  end_date: string
  student: { id: string; name: string; student_number: string | null }
}

export default function BillingPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [billing, setBilling] = useState<BillingItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // パスワード認証
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [storedPw, setStoredPw] = useState('')
  const [verifying, setVerifying] = useState(false)

  const handleAuth = async () => {
    if (!password) { toast.error('パスワードを入力してください'); return }
    setVerifying(true)
    try {
      const res = await fetch(`/api/contracts/billing?year=${year}&month=${month}&pw=${encodeURIComponent(password)}`)
      if (res.status === 403) {
        toast.error('パスワードが正しくありません')
        setVerifying(false)
        return
      }
      if (!res.ok) throw new Error('エラーが発生しました')
      const json = await res.json()
      setBilling(json.data || [])
      setTotal(json.total || 0)
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
    const fetchBilling = async () => {
      setLoading(true)
      const res = await fetch(`/api/contracts/billing?year=${year}&month=${month}&pw=${encodeURIComponent(storedPw)}`)
      if (res.ok) {
        const json = await res.json()
        setBilling(json.data || [])
        setTotal(json.total || 0)
      }
      setLoading(false)
    }
    fetchBilling()
  }, [year, month, authenticated, storedPw])

  // パスワード入力画面
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-bold">請求一覧</h2>
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
  const formatCourses = (courses: { course: string; lessons: number }[]) =>
    courses.map(c => `${c.course}(週${c.lessons})`).join(', ')

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">請求一覧</h2>
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
              {months.map(m => (
                <SelectItem key={m} value={String(m)}>{m}月</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">当月合計請求額</div>
          <div className="text-3xl font-bold">{formatYen(total)}</div>
          <div className="text-sm text-muted-foreground mt-1">{billing.length}件</div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>塾生番号</TableHead>
                  <TableHead>生徒名</TableHead>
                  <TableHead>コース</TableHead>
                  <TableHead className="text-right">月謝</TableHead>
                  <TableHead className="text-right">入塾金</TableHead>
                  <TableHead className="text-right">設備利用料</TableHead>
                  <TableHead className="text-right">合計</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billing.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-muted-foreground text-sm">{b.student?.student_number || '-'}</TableCell>
                    <TableCell className="font-medium">{b.student?.name}</TableCell>
                    <TableCell className="text-sm">{formatCourses(b.courses)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(b.tuition)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {b.enrollment_fee_amount > 0 ? formatYen(b.enrollment_fee_amount) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatYen(b.facility_fee)}
                      {b.facility_fee !== 3300 && (
                        <span className="text-xs text-muted-foreground ml-1">(半月)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">{formatYen(b.total_amount)}</TableCell>
                  </TableRow>
                ))}
                {billing.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      該当月の請求データがありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface BillingItem {
  id: string
  student_id: string
  grade: string
  courses: { course: string; lessons: number }[]
  monthly_amount: number
  effective_amount: number
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBilling = async () => {
      setLoading(true)
      const res = await fetch(`/api/contracts/billing?year=${year}&month=${month}`)
      const json = await res.json()
      setBilling(json.data || [])
      setTotal(json.total || 0)
      setLoading(false)
    }
    fetchBilling()
  }, [year, month])

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
                  <TableHead>学年</TableHead>
                  <TableHead>コース</TableHead>
                  <TableHead className="text-right">月謝</TableHead>
                  <TableHead className="text-right">当月請求額</TableHead>
                  <TableHead>契約期間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billing.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-muted-foreground text-sm">{b.student?.student_number || '-'}</TableCell>
                    <TableCell className="font-medium">{b.student?.name}</TableCell>
                    <TableCell>{b.grade}</TableCell>
                    <TableCell className="text-sm">{formatCourses(b.courses)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(b.monthly_amount)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {formatYen(b.effective_amount)}
                      {b.effective_amount !== b.monthly_amount && (
                        <span className="text-xs text-muted-foreground ml-1">(半月)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{b.start_date} ~ {b.end_date}</TableCell>
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

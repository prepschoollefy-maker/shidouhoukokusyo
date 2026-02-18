'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface SummaryItem {
  id: string
  student: { id: string; name: string }
  subject: { name: string } | null
  status: string
  period_start: string
  period_end: string
  report_count: number
  created_at: string
}

const statusLabels: Record<string, string> = {
  unchecked: '未チェック',
  approved: '承認済み',
  sent: '送信済み',
  on_hold: '保留',
}

const statusColors: Record<string, string> = {
  unchecked: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  on_hold: 'bg-gray-100 text-gray-800',
}

function SummariesContent() {
  const searchParams = useSearchParams()
  const [summaries, setSummaries] = useState<SummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')

  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)

    fetch(`/api/summaries?${params}`)
      .then(res => res.json())
      .then(json => { setSummaries(json.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [statusFilter])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">読み込み中...</p></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">AIまとめ一覧</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="unchecked">未チェック</SelectItem>
            <SelectItem value="approved">承認済み</SelectItem>
            <SelectItem value="sent">送信済み</SelectItem>
            <SelectItem value="on_hold">保留</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {summaries.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">まとめがありません</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {summaries.map((s) => (
            <Link key={s.id} href={`/admin/summaries/${s.id}`}>
              <Card className="hover:bg-gray-50 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.student.name}</span>
                        {s.subject && <Badge variant="secondary">{s.subject.name}</Badge>}
                        <Badge className={statusColors[s.status]}>{statusLabels[s.status]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(s.period_start), 'M/d', { locale: ja })} - {format(new Date(s.period_end), 'M/d', { locale: ja })}
                        {' · '}{s.report_count}件のレポート
                      </p>
                    </div>
                    <span className="text-muted-foreground">›</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SummariesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><p className="text-muted-foreground">読み込み中...</p></div>}>
      <SummariesContent />
    </Suspense>
  )
}

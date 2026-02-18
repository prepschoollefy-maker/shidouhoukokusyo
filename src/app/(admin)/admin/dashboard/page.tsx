'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { FileText, AlertTriangle, Users } from 'lucide-react'

interface DashboardData {
  unchecked_summaries: number
  teacher_report_counts: { name: string; count: number }[]
  missing_report_alerts: { student_id: string; student_name: string; expected: number; actual: number }[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(json => { setData(json.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">読み込み中...</p></div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">ダッシュボード</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/summaries?status=unchecked">
          <Card className="hover:bg-gray-50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">未チェックAIまとめ</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold">{data?.unchecked_summaries || 0}</span>
                {(data?.unchecked_summaries || 0) > 0 && (
                  <Badge variant="destructive">要確認</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">講師別入力件数（7日間）</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {data?.teacher_report_counts?.length ? (
              <ul className="space-y-1">
                {data.teacher_report_counts.map((t, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span>{t.name}</span>
                    <span className="font-medium">{t.count}件</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">データなし</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">未入力アラート</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {data?.missing_report_alerts?.length ? (
              <ul className="space-y-1">
                {data.missing_report_alerts.map((a, i) => (
                  <li key={i} className="text-sm text-orange-700">
                    {a.student_name}: {a.actual}/{a.expected}コマ
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-green-600">アラートなし</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

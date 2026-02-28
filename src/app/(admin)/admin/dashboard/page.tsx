'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { FileText, Users, GraduationCap } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface GradeStat {
  grade: string
  student_count: number
  monthly_revenue: number
  weekly_lessons: number
}

interface DashboardData {
  unchecked_summaries: number
  teacher_report_counts: { name: string; count: number }[]
  grade_stats: GradeStat[]
  total_students: number
  total_revenue: number
  total_weekly_lessons: number
  billing_month: string
}

const formatYen = (n: number) => `¥${n.toLocaleString()}`

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
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">ダッシュボード</h2>

      <div className="grid gap-4 md:grid-cols-2">
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
      </div>

      {/* 学年別統計 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            学年別統計（{data?.billing_month || ''}・通常コース）
          </CardTitle>
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>学年</TableHead>
                <TableHead className="text-right">在籍数</TableHead>
                <TableHead className="text-right">月額売上</TableHead>
                <TableHead className="text-right">週コマ数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.grade_stats?.map(g => (
                <TableRow key={g.grade}>
                  <TableCell className="font-medium">{g.grade}</TableCell>
                  <TableCell className="text-right">{g.student_count}人</TableCell>
                  <TableCell className="text-right font-mono">{formatYen(g.monthly_revenue)}</TableCell>
                  <TableCell className="text-right">{g.weekly_lessons}コマ</TableCell>
                </TableRow>
              ))}
              {(data?.grade_stats?.length || 0) > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>合計</TableCell>
                  <TableCell className="text-right">{data?.total_students || 0}人</TableCell>
                  <TableCell className="text-right font-mono">{formatYen(data?.total_revenue || 0)}</TableCell>
                  <TableCell className="text-right">{data?.total_weekly_lessons || 0}コマ</TableCell>
                </TableRow>
              )}
              {!data?.grade_stats?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    データなし
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

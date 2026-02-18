'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface ReportDetail {
  id: string
  lesson_date: string
  unit_covered: string
  homework_check: string
  free_comment: string | null
  homework_assigned: string
  next_lesson_plan: string | null
  internal_notes: string | null
  student: { name: string; grade: string | null }
  subject: { name: string }
  teacher: { display_name: string }
  report_textbooks: { textbook_name: string; pages: string | null }[]
  report_attitudes: { attitude_option: { label: string; category: string } }[]
}

const homeworkLabels: Record<string, string> = {
  done: 'やってきた',
  partial: '一部やった',
  not_done: 'やってきていない',
}

export default function ReportDetailPage() {
  const params = useParams()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReport = async () => {
      const res = await fetch(`/api/reports/${params.id}`)
      const json = await res.json()
      setReport(json.data)
      setLoading(false)
    }
    fetchReport()
  }, [params.id])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">読み込み中...</p></div>
  }

  if (!report) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">レポートが見つかりません</p></div>
  }

  const positiveAttitudes = report.report_attitudes.filter(a => a.attitude_option.category === 'positive')
  const negativeAttitudes = report.report_attitudes.filter(a => a.attitude_option.category === 'negative')

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">レポート詳細</h2>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{report.student.name}</CardTitle>
            <Badge variant="secondary">{report.subject.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(report.lesson_date), 'yyyy年M月d日(E)', { locale: ja })}
            {' · '}
            {report.teacher.display_name}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">使用テキスト</h4>
            <ul className="mt-1 space-y-1">
              {report.report_textbooks.map((t, i) => (
                <li key={i} className="text-sm">
                  {t.textbook_name}{t.pages ? ` / ${t.pages}` : ''}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground">扱った単元</h4>
            <p className="mt-1 text-sm">{report.unit_covered}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground">前回宿題チェック</h4>
            <p className="mt-1 text-sm">{homeworkLabels[report.homework_check]}</p>
          </div>

          {positiveAttitudes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">生徒の様子（ポジティブ）</h4>
              <div className="flex flex-wrap gap-1 mt-1">
                {positiveAttitudes.map((a, i) => (
                  <Badge key={i} variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                    {a.attitude_option.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {negativeAttitudes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">生徒の様子（ネガティブ）</h4>
              <div className="flex flex-wrap gap-1 mt-1">
                {negativeAttitudes.map((a, i) => (
                  <Badge key={i} variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                    {a.attitude_option.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {report.free_comment && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">様子の自由コメント</h4>
              <p className="mt-1 text-sm">{report.free_comment}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-muted-foreground">宿題内容</h4>
            <p className="mt-1 text-sm">{report.homework_assigned}</p>
          </div>

          {report.next_lesson_plan && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">次回やること</h4>
              <p className="mt-1 text-sm">{report.next_lesson_plan}</p>
            </div>
          )}

          {report.internal_notes && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">講師間申し送り</h4>
              <p className="mt-1 text-sm bg-yellow-50 p-2 rounded">{report.internal_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

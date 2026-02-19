'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface ReportDetail {
  id: string
  lesson_date: string
  unit_covered: string
  homework_check: string
  strengths: string | null
  weaknesses: string | null
  free_comment: string | null
  homework_assigned: string
  next_lesson_plan: string | null
  internal_notes: string | null
  ai_summary: string | null
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
  const router = useRouter()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    const fetchReport = async () => {
      const res = await fetch(`/api/reports/${params.id}`)
      const json = await res.json()
      setReport(json.data)
      setLoading(false)
    }
    fetchReport()
  }, [params.id])

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/reports/${params.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('レポートを削除しました')
      router.push('/reports')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '削除に失敗しました')
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (!report) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">レポートが見つかりません</p></div>
  }

  const positiveAttitudes = report.report_attitudes.filter(a => a.attitude_option.category === 'positive')
  const negativeAttitudes = report.report_attitudes.filter(a => a.attitude_option.category === 'negative')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />戻る
          </Button>
          <h2 className="text-xl font-bold">レポート詳細</h2>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/reports/${params.id}/edit`}>
              <Pencil className="h-4 w-4 mr-1" />編集
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" />削除
          </Button>
        </div>
      </div>

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

          {report.strengths && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">理解できていたこと・得意なこと</h4>
              <p className="mt-1 text-sm whitespace-pre-wrap">{report.strengths}</p>
            </div>
          )}

          {report.weaknesses && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">理解不十分・苦手なこと</h4>
              <p className="mt-1 text-sm whitespace-pre-wrap">{report.weaknesses}</p>
            </div>
          )}

          {report.free_comment && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">様子の自由コメント</h4>
              <p className="mt-1 text-sm whitespace-pre-wrap">{report.free_comment}</p>
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

          {report.ai_summary && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">AI授業レポート</h4>
              <p className="mt-1 text-sm whitespace-pre-wrap bg-blue-50 p-3 rounded">{report.ai_summary}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="レポートを削除"
        description="このレポートを削除しますか？この操作は取り消せません。"
        onConfirm={() => { handleDelete(); setDeleteOpen(false) }}
      />
    </div>
  )
}

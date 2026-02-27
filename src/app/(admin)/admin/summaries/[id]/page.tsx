'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Check, RefreshCw, Pause, Eye, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ReportContent } from '@/components/ui/report-content'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const homeworkLabels: Record<string, string> = {
  done: 'やってきた',
  partial: '一部やった',
  not_done: 'やってきていない',
}

export default function SummaryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [summary, setSummary] = useState<any>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview')

  useEffect(() => {
    fetch(`/api/summaries/${params.id}`)
      .then(res => res.json())
      .then(json => {
        setSummary(json.data)
        setContent(json.data?.content || '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id])

  const handleAction = async (action: 'approve' | 'hold' | 'regenerate') => {
    setActionLoading(true)
    try {
      if (action === 'regenerate') {
        const res = await fetch('/api/summaries/generate-monthly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_date: summary.period_start,
            end_date: summary.period_end,
            student_id: summary.student_id,
          }),
        })
        if (!res.ok) throw new Error('再生成に失敗しました')
        toast.success('レポートを再生成しました')
        router.push('/admin/summaries')
        return
      }

      const newStatus = action === 'approve' ? 'approved' : 'on_hold'
      const res = await fetch(`/api/summaries/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, content }),
      })
      if (!res.ok) throw new Error('更新に失敗しました')
      toast.success(action === 'approve' ? '承認しました' : '保留にしました')
      router.push('/admin/summaries')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSend = async () => {
    setActionLoading(true)
    try {
      await fetch(`/api/summaries/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', content }),
      })

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_id: params.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '送信に失敗しました')
      }
      toast.success('メールを送信しました')
      setSendDialogOpen(false)
      router.push('/admin/summaries')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '送信に失敗しました')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (!summary) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">まとめが見つかりません</p></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">まとめ詳細</h2>
        <Button variant="outline" onClick={() => router.back()}>戻る</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: Summary content */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {summary.student.name}
                <Badge variant="secondary">
                  {format(new Date(summary.period_start), 'M/d')} - {format(new Date(summary.period_end), 'M/d')}
                </Badge>
              </CardTitle>
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors',
                    viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Eye className="h-3 w-3" />
                  プレビュー
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors border-l',
                    viewMode === 'edit' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Pencil className="h-3 w-3" />
                  編集
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {viewMode === 'edit' ? (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
            ) : (
              <div className="min-h-[400px] rounded-lg border bg-gradient-to-br from-slate-50 to-white p-4 overflow-y-auto">
                <ReportContent content={content} />
              </div>
            )}

            <div className="flex gap-2">
              <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">承認して送信</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>メール送信の確認</DialogTitle>
                    <DialogDescription>
                      {summary.student.name}さんの保護者にメールを送信します。よろしいですか？
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSendDialogOpen(false)}>キャンセル</Button>
                    <Button onClick={handleSend} disabled={actionLoading}>
                      {actionLoading ? '送信中...' : '送信する'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="その他の操作">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleAction('approve')} disabled={actionLoading}>
                    <Check className="h-4 w-4 mr-2" />承認のみ
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction('regenerate')} disabled={actionLoading}>
                    <RefreshCw className="h-4 w-4 mr-2" />再生成
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction('hold')} disabled={actionLoading}>
                    <Pause className="h-4 w-4 mr-2" />保留
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Right: Source reports */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">元のレポート</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
            {summary.summary_reports?.map((sr: any) => {
              const r = sr.report
              if (!r) return null
              return (
                <Card key={sr.id} className="bg-gray-50">
                  <CardContent className="py-3 px-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">{r.subject?.name}</Badge>
                      <span>{format(new Date(r.lesson_date), 'M月d日(E)', { locale: ja })}</span>
                      <span className="text-muted-foreground">{r.teacher?.display_name}</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p><span className="font-medium">単元:</span> {r.unit_covered}</p>
                      <p><span className="font-medium">テキスト:</span> {r.report_textbooks?.map((t: any) => `${t.textbook_name}${t.pages ? ` (${t.pages})` : ''}`).join('、')}</p>
                      <p><span className="font-medium">宿題:</span> {homeworkLabels[r.homework_check]}</p>
                      {r.report_attitudes?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {r.report_attitudes.map((a: any) => (
                            <Badge key={a.id} variant="outline" className="text-xs">
                              {a.attitude_option?.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {r.strengths && <p><span className="font-medium">得意:</span> {r.strengths}</p>}
                      {r.weaknesses && <p><span className="font-medium">苦手:</span> {r.weaknesses}</p>}
                      {r.free_comment && <p className="text-muted-foreground">{r.free_comment}</p>}
                      <p><span className="font-medium">出した宿題:</span> {r.homework_assigned}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

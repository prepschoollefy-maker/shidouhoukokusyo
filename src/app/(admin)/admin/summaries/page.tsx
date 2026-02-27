'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'sonner'
import { FileText, Loader2, Send, ChevronDown, ChevronRight } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { groupByGrade, getGradeColor, getGradeSectionBorder, getGradeSectionLabel, getGradeDot } from '@/lib/grade-utils'

interface SummaryItem {
  id: string
  student: { id: string; name: string; grade: string | null }
  subject: { name: string } | null
  status: string
  period_start: string
  period_end: string
  report_count: number
  created_at: string
}

interface StudentTarget {
  id: string
  name: string
  report_count: number
}

interface StudentSummaryGroup {
  student_id: string
  student_name: string
  grade: string | null
  summaries: SummaryItem[]
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

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function SummariesContent() {
  const searchParams = useSearchParams()
  const [summaries, setSummaries] = useState<SummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')

  // Generation dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, currentName: '' })

  // Bulk send
  const [selectedSendIds, setSelectedSendIds] = useState<Set<string>>(new Set())
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, currentName: '' })

  // Accordion
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set())

  // Date range (default: first of current month to today)
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const [startDate, setStartDate] = useState(toDateString(firstOfMonth))
  const [endDate, setEndDate] = useState(toDateString(now))

  // Student selection
  const [students, setStudents] = useState<StudentTarget[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadingStudents, setLoadingStudents] = useState(false)

  const fetchSummaries = () => {
    const params = new URLSearchParams()
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)

    fetch(`/api/summaries?${params}`)
      .then(res => res.json())
      .then(json => { setSummaries(json.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchSummaries() }, [statusFilter])
  useEffect(() => { setSelectedSendIds(new Set()) }, [statusFilter])

  // Group summaries by student
  const studentGroups: StudentSummaryGroup[] = (() => {
    const map = new Map<string, StudentSummaryGroup>()
    for (const s of summaries) {
      let group = map.get(s.student.id)
      if (!group) {
        group = {
          student_id: s.student.id,
          student_name: s.student.name,
          grade: s.student.grade,
          summaries: [],
        }
        map.set(s.student.id, group)
      }
      group.summaries.push(s)
    }
    return Array.from(map.values())
  })()

  const gradeGroups = groupByGrade(studentGroups, g => g.grade)

  const toggleStudentExpanded = (studentId: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  // Fetch target students when date range changes
  const fetchStudents = async () => {
    if (!startDate || !endDate) return
    setLoadingStudents(true)
    setStudents([])
    setSelectedIds(new Set())
    try {
      const res = await fetch(`/api/summaries/generate-monthly?start_date=${startDate}&end_date=${endDate}`)
      if (res.status === 404) {
        setStudents([])
        return
      }
      if (!res.ok) throw new Error('取得に失敗しました')
      const json = await res.json()
      const list: StudentTarget[] = json.students || []
      setStudents(list)
      setSelectedIds(new Set(list.map(s => s.id)))
    } catch {
      setStudents([])
    } finally {
      setLoadingStudents(false)
    }
  }

  useEffect(() => {
    if (dialogOpen && startDate && endDate) {
      fetchStudents()
    }
  }, [dialogOpen, startDate, endDate])

  const toggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(students.map(s => s.id)))
    }
  }

  const handleGenerate = async () => {
    if (generating || selectedIds.size === 0) return
    setGenerating(true)

    const targets = students.filter(s => selectedIds.has(s.id))
    setProgress({ current: 0, total: targets.length, currentName: '' })

    let successCount = 0
    const errors: string[] = []

    for (let i = 0; i < targets.length; i++) {
      const student = targets[i]
      setProgress({ current: i, total: targets.length, currentName: student.name })

      try {
        const res = await fetch('/api/summaries/generate-monthly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_date: startDate,
            end_date: endDate,
            student_id: student.id,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error)
        }
        successCount++
      } catch (e) {
        errors.push(`${student.name}: ${e instanceof Error ? e.message : '失敗'}`)
      }
    }

    setProgress({ current: targets.length, total: targets.length, currentName: '' })
    toast.success(`${successCount}/${targets.length}件のレポートを生成しました`)
    if (errors.length) {
      toast.error(`エラー: ${errors.join(', ')}`)
    }

    setDialogOpen(false)
    setGenerating(false)
    fetchSummaries()
  }

  // Bulk send helpers
  const sendableSummaries = summaries.filter(s => s.status !== 'sent')

  const toggleSendItem = (id: string) => {
    setSelectedSendIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllSend = () => {
    if (selectedSendIds.size === sendableSummaries.length) {
      setSelectedSendIds(new Set())
    } else {
      setSelectedSendIds(new Set(sendableSummaries.map(s => s.id)))
    }
  }

  const handleBulkSend = async () => {
    if (sending || selectedSendIds.size === 0) return
    setSending(true)

    const targets = summaries.filter(s => selectedSendIds.has(s.id))
    setSendProgress({ current: 0, total: targets.length, currentName: '' })

    let successCount = 0
    const errors: string[] = []

    for (let i = 0; i < targets.length; i++) {
      const s = targets[i]
      setSendProgress({ current: i, total: targets.length, currentName: s.student.name })

      try {
        if (s.status !== 'approved') {
          const approveRes = await fetch(`/api/summaries/${s.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' }),
          })
          if (!approveRes.ok) throw new Error('承認に失敗')
        }

        const sendRes = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary_id: s.id }),
        })
        if (!sendRes.ok) {
          const err = await sendRes.json()
          throw new Error(err.error || '送信に失敗')
        }
        successCount++
      } catch (e) {
        errors.push(`${s.student.name}: ${e instanceof Error ? e.message : '失敗'}`)
      }
    }

    setSendProgress({ current: targets.length, total: targets.length, currentName: '' })
    toast.success(`${successCount}/${targets.length}件を送信しました`)
    if (errors.length) {
      toast.error(`エラー: ${errors.join(', ')}`)
    }

    setSendDialogOpen(false)
    setSending(false)
    setSelectedSendIds(new Set())
    fetchSummaries()
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">定期レポート一覧</h2>
        <div className="flex gap-2">
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

          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!generating) setDialogOpen(open) }}>
            <DialogTrigger asChild>
              <Button>
                <FileText className="h-4 w-4 mr-1" />レポート生成
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>定期レポート生成</DialogTitle>
                <DialogDescription>
                  指定した期間のレポートをもとに、生徒ごとの学習まとめをAIで生成します。
                </DialogDescription>
              </DialogHeader>

              {generating ? (
                <div className="space-y-3 py-2">
                  <div className="flex justify-between text-sm">
                    <span>{progress.currentName ? `生成中: ${progress.currentName}` : '準備中...'}</span>
                    <span>{progress.current}/{progress.total}</span>
                  </div>
                  <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} />
                </div>
              ) : (
                <>
                  <div className="flex gap-4">
                    <div className="space-y-2 flex-1">
                      <Label>開始日</Label>
                      <input
                        type="date"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 flex-1">
                      <Label>終了日</Label>
                      <input
                        type="date"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>対象生徒</Label>
                      {students.length > 0 && (
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:underline"
                          onClick={toggleAll}
                        >
                          {selectedIds.size === students.length ? 'すべて解除' : 'すべて選択'}
                        </button>
                      )}
                    </div>

                    {loadingStudents ? (
                      <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        生徒を取得中...
                      </div>
                    ) : students.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        この期間にレポートがある生徒がいません
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                        {students.map((s) => (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedIds.has(s.id)}
                              onCheckedChange={() => toggleStudent(s.id)}
                            />
                            <span className="text-sm flex-1">{s.name}</span>
                            <span className="text-xs text-muted-foreground">{s.report_count}件</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
                    <Button onClick={handleGenerate} disabled={selectedIds.size === 0}>
                      {selectedIds.size > 0 ? `${selectedIds.size}名分を生成` : '生成する'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk send action bar */}
      {selectedSendIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-blue-50 border-blue-200 p-3">
          <span className="text-sm font-medium">{selectedSendIds.size}件選択中</span>
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline"
            onClick={toggleAllSend}
          >
            {selectedSendIds.size === sendableSummaries.length ? 'すべて解除' : 'すべて選択'}
          </button>
          <div className="flex-1" />
          <Dialog open={sendDialogOpen} onOpenChange={(open) => { if (!sending) setSendDialogOpen(open) }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Send className="h-3.5 w-3.5" />
                一斉送信
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>一斉送信確認</DialogTitle>
                <DialogDescription>
                  選択した{selectedSendIds.size}件の定期レポートを保護者へメール送信します。未承認のレポートは自動的に承認されます。
                </DialogDescription>
              </DialogHeader>

              {sending ? (
                <div className="space-y-3 py-2">
                  <div className="flex justify-between text-sm">
                    <span>{sendProgress.currentName ? `送信中: ${sendProgress.currentName}` : '準備中...'}</span>
                    <span>{sendProgress.current}/{sendProgress.total}</span>
                  </div>
                  <Progress value={sendProgress.total ? (sendProgress.current / sendProgress.total) * 100 : 0} />
                </div>
              ) : (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSendDialogOpen(false)}>キャンセル</Button>
                  <Button onClick={handleBulkSend}>
                    {selectedSendIds.size}件を送信する
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {summaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">定期レポートがありません</p>
            <p className="text-sm text-muted-foreground/70 mt-1">「レポート生成」ボタンから定期レポートを生成できます</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {gradeGroups.map((gradeGroup) => (
            <section key={gradeGroup.category}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-2 h-2 rounded-full ${getGradeDot(gradeGroup.category)}`} />
                <h3 className={`text-sm font-semibold tracking-wide ${getGradeSectionLabel(gradeGroup.category)}`}>
                  {gradeGroup.label}
                </h3>
                <span className="text-xs text-muted-foreground">{gradeGroup.items.length}名</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className={`space-y-1.5 border-l-2 ${getGradeSectionBorder(gradeGroup.category)} pl-4`}>
                {gradeGroup.items.map((group) => {
                  const isExpanded = expandedStudents.has(group.student_id)

                  return (
                    <Card key={group.student_id} className="shadow-sm hover:shadow transition-shadow">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => toggleStudentExpanded(group.student_id)}
                      >
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              }
                              <span className="font-medium">{group.student_name}</span>
                              {group.grade && (
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getGradeColor(group.grade)}`}>
                                  {group.grade}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="tabular-nums">{group.summaries.length}件</span>
                            </div>
                          </div>
                        </CardContent>
                      </button>

                      {isExpanded && (
                        <div className="border-t bg-muted/20 px-4 pb-3">
                          <div className="divide-y divide-border/50">
                            {group.summaries.map((s) => (
                              <div key={s.id} className="flex items-center gap-2 py-2.5">
                                {s.status !== 'sent' && (
                                  <Checkbox
                                    checked={selectedSendIds.has(s.id)}
                                    onCheckedChange={() => toggleSendItem(s.id)}
                                  />
                                )}
                                {s.status === 'sent' && <div className="w-4" />}
                                <Link
                                  href={`/admin/summaries/${s.id}`}
                                  className="flex-1 flex items-center justify-between hover:bg-background -mx-2 px-2 rounded transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground tabular-nums w-24">
                                      {format(new Date(s.period_start), 'M/d', { locale: ja })} - {format(new Date(s.period_end), 'M/d', { locale: ja })}
                                    </span>
                                    {s.subject && <Badge variant="secondary" className="text-xs font-normal">{s.subject.name}</Badge>}
                                    <Badge className={`text-xs ${statusColors[s.status]}`}>{statusLabels[s.status]}</Badge>
                                    <span className="text-xs text-muted-foreground">{s.report_count}件</span>
                                  </div>
                                  <span className="text-muted-foreground text-xs">›</span>
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SummariesPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SummariesContent />
    </Suspense>
  )
}

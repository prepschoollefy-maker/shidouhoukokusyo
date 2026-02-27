'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { PaginationControl } from '@/components/ui/pagination-control'
import { ArrowLeft, ChevronDown, ChevronUp, BookOpen, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface StudentInfo {
  id: string
  name: string
  grade: string | null
  student_subjects: {
    id: string
    subject_id: string
    subject: { id: string; name: string }
  }[]
}

interface Report {
  id: string
  lesson_date: string
  unit_covered: string
  homework_check: string | null
  homework_assigned: string | null
  next_lesson_plan: string | null
  internal_notes: string | null
  strengths: string | null
  weaknesses: string | null
  free_comment: string | null
  ai_summary: string | null
  subject: { id: string; name: string }
  teacher: { id: string; display_name: string }
  report_textbooks: { id: string; textbook_name: string; pages: string | null; sort_order: number }[]
  report_attitudes: {
    id: string
    attitude_option_id: string
    attitude_option: { id: string; label: string; category: string }
  }[]
}

const PER_PAGE = 20

const homeworkCheckLabels: Record<string, string> = {
  done: '完了',
  partial: '一部',
  not_done: '未実施',
  none: 'なし',
}

export default function StudentKartePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) })
    const res = await fetch(`/api/students/${id}/history?${params}`)
    const json = await res.json()
    setStudent(json.student || null)
    setReports(json.reports || [])
    setTotalCount(json.count || 0)
    setLoading(false)
  }, [id, page])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const toggleExpand = (reportId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(reportId)) {
        next.delete(reportId)
      } else {
        next.add(reportId)
      }
      return next
    })
  }

  const totalPages = Math.ceil(totalCount / PER_PAGE)
  const latestReport = page === 1 && reports.length > 0 ? reports[0] : null

  if (loading) {
    return <LoadingSpinner />
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          戻る
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">生徒が見つかりません</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">{student.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {student.grade && (
              <span className="text-sm text-muted-foreground">{student.grade}</span>
            )}
            {student.student_subjects.map((ss) => (
              <Badge key={ss.id} variant="secondary" className="text-xs">
                {ss.subject.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Latest homework highlight */}
      {latestReport && (latestReport.homework_assigned || latestReport.next_lesson_plan || latestReport.internal_notes) && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
              <BookOpen className="h-4 w-4" />
              直近の申し送り
              <span className="font-normal text-amber-600">
                ({format(new Date(latestReport.lesson_date), 'M/d', { locale: ja })} {latestReport.subject.name} - {latestReport.teacher.display_name})
              </span>
            </div>
            {latestReport.homework_assigned && (
              <div>
                <span className="text-xs font-medium text-amber-700">宿題: </span>
                <span className="text-sm text-amber-900">{latestReport.homework_assigned}</span>
              </div>
            )}
            {latestReport.next_lesson_plan && (
              <div>
                <span className="text-xs font-medium text-amber-700">次回予定: </span>
                <span className="text-sm text-amber-900">{latestReport.next_lesson_plan}</span>
              </div>
            )}
            {latestReport.internal_notes && (
              <div>
                <span className="text-xs font-medium text-amber-700">講師間申し送り: </span>
                <span className="text-sm text-amber-900">{latestReport.internal_notes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reports timeline */}
      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">まだレポートがありません</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">全{totalCount}件のレポート</p>
          <div className="space-y-2">
            {reports.map((report) => {
              const isExpanded = expandedIds.has(report.id)
              const positiveAttitudes = report.report_attitudes.filter(
                (a) => a.attitude_option.category === 'positive'
              )
              const negativeAttitudes = report.report_attitudes.filter(
                (a) => a.attitude_option.category === 'negative'
              )

              return (
                <Card key={report.id}>
                  <CardContent className="p-0">
                    {/* Collapsed summary - always visible */}
                    <button
                      onClick={() => toggleExpand(report.id)}
                      className="w-full text-left py-3 px-4 flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {format(new Date(report.lesson_date), 'M月d日(E)', { locale: ja })}
                          </span>
                          <Badge variant="secondary" className="text-xs">{report.subject.name}</Badge>
                          <span className="text-xs text-muted-foreground">{report.teacher.display_name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {report.unit_covered}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                      )}
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-0 space-y-2 border-t">
                        {report.ai_summary ? (
                          <>
                            {/* AI Summary */}
                            <div className="pt-2">
                              <span className="text-xs font-medium text-muted-foreground">AI授業レポート</span>
                              <div className="text-sm mt-1 whitespace-pre-wrap leading-relaxed">{report.ai_summary}</div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Fallback: raw data */}
                            {report.report_textbooks.length > 0 && (
                              <DetailRow label="テキスト・ページ">
                                {report.report_textbooks
                                  .sort((a, b) => a.sort_order - b.sort_order)
                                  .map((t) => (
                                    <span key={t.id} className="block text-sm">
                                      {t.textbook_name}{t.pages ? ` (${t.pages})` : ''}
                                    </span>
                                  ))}
                              </DetailRow>
                            )}
                            {report.homework_check && (
                              <DetailRow label="宿題チェック">
                                <Badge variant={report.homework_check === 'done' ? 'default' : 'secondary'} className="text-xs">
                                  {homeworkCheckLabels[report.homework_check] || report.homework_check}
                                </Badge>
                              </DetailRow>
                            )}
                            {report.homework_assigned && (
                              <DetailRow label="宿題">{report.homework_assigned}</DetailRow>
                            )}
                            {report.next_lesson_plan && (
                              <DetailRow label="次回予定">{report.next_lesson_plan}</DetailRow>
                            )}
                            {positiveAttitudes.length > 0 && (
                              <DetailRow label="良い点">
                                <div className="flex flex-wrap gap-1">
                                  {positiveAttitudes.map((a) => (
                                    <Badge key={a.id} variant="default" className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                                      {a.attitude_option.label}
                                    </Badge>
                                  ))}
                                </div>
                              </DetailRow>
                            )}
                            {negativeAttitudes.length > 0 && (
                              <DetailRow label="課題">
                                <div className="flex flex-wrap gap-1">
                                  {negativeAttitudes.map((a) => (
                                    <Badge key={a.id} variant="secondary" className="text-xs bg-red-50 text-red-700">
                                      {a.attitude_option.label}
                                    </Badge>
                                  ))}
                                </div>
                              </DetailRow>
                            )}
                            {report.strengths && (
                              <DetailRow label="強み">{report.strengths}</DetailRow>
                            )}
                            {report.weaknesses && (
                              <DetailRow label="弱み">{report.weaknesses}</DetailRow>
                            )}
                            {report.free_comment && (
                              <DetailRow label="自由記述">{report.free_comment}</DetailRow>
                            )}
                          </>
                        )}

                        {/* Internal notes - always shown (excluded from AI summary) */}
                        {report.internal_notes && (
                          <DetailRow label="講師間申し送り">{report.internal_notes}</DetailRow>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <PaginationControl page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="text-sm mt-0.5">{children}</div>
    </div>
  )
}

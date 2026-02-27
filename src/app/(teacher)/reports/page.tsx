'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { PaginationControl } from '@/components/ui/pagination-control'
import { FileText, Search, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface ReportItem {
  id: string
  lesson_date: string
  unit_covered: string
  subject_name: string
  teacher_name: string
}

interface StudentGroup {
  student_id: string
  student_name: string
  grade: string | null
  subjects: string[]
  report_count: number
  latest_date: string
  latest_reports: ReportItem[]
}

const PER_PAGE = 20

export default function ReportsPage() {
  const [groups, setGroups] = useState<StudentGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [fullReports, setFullReports] = useState<Record<string, ReportItem[]>>({})
  const [loadingFull, setLoadingFull] = useState<Set<string>>(new Set())

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(inputValue)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const fetchGroups = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) })
    if (search) params.set('search', search)

    try {
      const res = await fetch(`/api/reports/grouped?${params}`, { signal: controller.signal })
      const json = await res.json()
      setGroups(json.data || [])
      setTotalCount(json.count || 0)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  const totalPages = Math.ceil(totalCount / PER_PAGE)

  const toggleExpanded = async (studentId: string, reportCount: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })

    if (!expandedIds.has(studentId) && reportCount > 5 && !fullReports[studentId]) {
      setLoadingFull(prev => new Set(prev).add(studentId))
      try {
        const res = await fetch(`/api/reports?student_id=${studentId}&limit=100`)
        const json = await res.json()
        const items: ReportItem[] = (json.data || []).map((r: { id: string; lesson_date: string; unit_covered: string; subject: { name: string }; teacher: { display_name: string } }) => ({
          id: r.id,
          lesson_date: r.lesson_date,
          unit_covered: r.unit_covered,
          subject_name: r.subject.name,
          teacher_name: r.teacher.display_name,
        }))
        setFullReports(prev => ({ ...prev, [studentId]: items }))
      } catch {
        // fallback to latest_reports
      } finally {
        setLoadingFull(prev => {
          const next = new Set(prev)
          next.delete(studentId)
          return next
        })
      }
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">レポート一覧</h2>
        <Button asChild>
          <Link href="/reports/new">新規入力</Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="生徒名で検索..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="pl-9"
        />
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">
              {search ? `「${search}」に一致するレポートはありません` : 'まだレポートがありません'}
            </p>
            {!search && (
              <Button asChild>
                <Link href="/reports/new">最初のレポートを入力する</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{totalCount}名の生徒</p>
          <div className="space-y-2">
            {groups.map((group) => {
              const isExpanded = expandedIds.has(group.student_id)
              const reports = fullReports[group.student_id] || group.latest_reports
              const isLoadingMore = loadingFull.has(group.student_id)

              return (
                <Card key={group.student_id}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => toggleExpanded(group.student_id, group.report_count)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          }
                          <span className="font-medium">{group.student_name}</span>
                          {group.grade && <Badge variant="outline" className="text-xs">{group.grade}</Badge>}
                          {group.subjects.map(s => (
                            <Badge key={s} variant="secondary">{s}</Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{group.report_count}件</span>
                          <span>{format(new Date(group.latest_date), 'M/d', { locale: ja })}</span>
                        </div>
                      </div>
                    </CardContent>
                  </button>

                  {isExpanded && (
                    <div className="border-t px-4 pb-3">
                      {isLoadingMore ? (
                        <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          読み込み中...
                        </div>
                      ) : (
                        <div className="divide-y">
                          {reports.map((r) => (
                            <Link
                              key={r.id}
                              href={`/reports/${r.id}`}
                              className="flex items-center justify-between py-2 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground w-16">
                                  {format(new Date(r.lesson_date), 'M/d(E)', { locale: ja })}
                                </span>
                                <Badge variant="secondary" className="text-xs">{r.subject_name}</Badge>
                                <span className="text-sm">{r.unit_covered}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">{r.teacher_name}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { PaginationControl } from '@/components/ui/pagination-control'
import { FileText, Search } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface Report {
  id: string
  lesson_date: string
  unit_covered: string
  student: { id: string; name: string }
  subject: { id: string; name: string }
  teacher: { display_name: string }
}

const PER_PAGE = 20

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(inputValue)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const fetchReports = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) })
    if (search) params.set('search', search)

    try {
      const res = await fetch(`/api/reports?${params}`, { signal: controller.signal })
      const json = await res.json()
      setReports(json.data || [])
      setTotalCount(json.count || 0)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchReports() }, [fetchReports])

  const totalPages = Math.ceil(totalCount / PER_PAGE)

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

      {reports.length === 0 ? (
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
          <p className="text-sm text-muted-foreground">{totalCount}件</p>
          <div className="space-y-2">
            {reports.map((report) => (
              <Link key={report.id} href={`/reports/${report.id}`}>
                <Card className="hover:bg-gray-50 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{report.student.name}</span>
                          <Badge variant="secondary">{report.subject.name}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(report.lesson_date), 'M月d日(E)', { locale: ja })}
                          {' · '}
                          {report.unit_covered}
                        </p>
                      </div>
                      <span className="text-muted-foreground text-sm">›</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <PaginationControl page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

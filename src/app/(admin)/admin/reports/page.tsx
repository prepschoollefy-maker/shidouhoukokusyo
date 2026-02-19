'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { PaginationControl } from '@/components/ui/pagination-control'
import { FileText, Search } from 'lucide-react'

interface Report {
  id: string
  lesson_date: string
  unit_covered: string
  student: { id: string; name: string }
  subject: { id: string; name: string }
  teacher: { display_name: string }
}

const PER_PAGE = 20

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const fetchReports = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) })
    if (search) params.set('search', search)

    fetch(`/api/reports?${params}`)
      .then(res => res.json())
      .then(json => {
        setReports(json.data || [])
        setTotalCount(json.count || 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [page, search])

  useEffect(() => { fetchReports() }, [fetchReports])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const totalPages = Math.ceil(totalCount / PER_PAGE)

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">レポート一覧</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="生徒名で検索..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {search ? `「${search}」に一致するレポートはありません` : 'レポートがありません'}
            </p>
            {!search && <p className="text-sm text-muted-foreground/70 mt-1">講師がレポートを入力すると、ここに表示されます</p>}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{totalCount}件</p>
          <div className="space-y-2">
            {reports.map((report) => (
              <Link key={report.id} href={`/admin/reports/${report.id}`}>
                <Card className="hover:bg-gray-50 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{report.student.name}</span>
                          <Badge variant="secondary">{report.subject.name}</Badge>
                          <span className="text-xs text-muted-foreground">{report.teacher.display_name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(report.lesson_date), 'M月d日(E)', { locale: ja })}
                          {' · '}{report.unit_covered}
                        </p>
                      </div>
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

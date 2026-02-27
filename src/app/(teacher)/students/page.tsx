'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { PaginationControl } from '@/components/ui/pagination-control'
import { Search, Users } from 'lucide-react'

interface Student {
  id: string
  name: string
  grade: string | null
  student_subjects: {
    id: string
    subject_id: string
    subject: { id: string; name: string }
  }[]
}

const PER_PAGE = 30

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
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

  const fetchStudents = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) })
    if (search) params.set('q', search)

    try {
      const res = await fetch(`/api/students/search?${params}`, { signal: controller.signal })
      const json = await res.json()
      setStudents(json.data || [])
      setTotalCount(json.count || 0)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const totalPages = Math.ceil(totalCount / PER_PAGE)

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">生徒カルテ</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="生徒名で検索..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="pl-9"
        />
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {search ? `「${search}」に一致する生徒はいません` : '生徒が登録されていません'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{totalCount}名</p>
          <div className="space-y-2">
            {students.map((student) => (
              <Link key={student.id} href={`/students/${student.id}`}>
                <Card className="hover:bg-gray-50 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{student.name}</span>
                          {student.grade && (
                            <span className="text-sm text-muted-foreground">{student.grade}</span>
                          )}
                        </div>
                        {student.student_subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {student.student_subjects.map((ss) => (
                              <Badge key={ss.id} variant="secondary" className="text-xs">
                                {ss.subject.name}
                              </Badge>
                            ))}
                          </div>
                        )}
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

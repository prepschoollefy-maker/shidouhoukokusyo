'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Search } from 'lucide-react'

const DAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

interface Template {
  id: string
  day_of_week: number
  is_active: boolean
  teacher: { id: string; display_name: string } | null
  subject: { id: string; name: string } | null
  time_slot: { id: string; label: string; start_time: string; end_time: string; sort_order: number } | null
}

interface Contract {
  id: string
  start_date: string
  end_date: string
  courses: { course: string; lessons: number }[]
  grade: string
}

interface StudentEntry {
  student: { id: string; name: string; student_number: string | null; grade: string | null }
  contracts: Contract[]
  templates: Template[]
}

export default function StudentLessonsPage() {
  const [data, setData] = useState<StudentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/lesson-templates/by-student')
    const json = await res.json()
    setData(json.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <LoadingSpinner />

  const filtered = data.filter((entry) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      entry.student.name.toLowerCase().includes(q) ||
      (entry.student.student_number || '').toLowerCase().includes(q) ||
      (entry.student.grade || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">生徒別授業</h2>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="生徒名・学年で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {searchQuery ? '該当する生徒が見つかりません' : '通常授業テンプレートが登録されていません'}
        </p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((entry) => (
            <StudentCard key={entry.student.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

function StudentCard({ entry }: { entry: StudentEntry }) {
  const { student, contracts, templates } = entry

  // 現在有効な契約を判定
  const today = new Date().toISOString().split('T')[0]
  const activeContracts = contracts.filter(
    (c) => c.start_date <= today && c.end_date >= today,
  )
  // 最新の契約を表示用に
  const latestContract = contracts.sort((a, b) => b.start_date.localeCompare(a.start_date))[0]

  // テンプレートをsort_orderでソート
  const sortedTemplates = [...templates].sort((a, b) => {
    const dayDiff = a.day_of_week - b.day_of_week
    if (dayDiff !== 0) return dayDiff
    return (a.time_slot?.sort_order ?? 0) - (b.time_slot?.sort_order ?? 0)
  })

  const activeTemplates = sortedTemplates.filter((t) => t.is_active)
  const inactiveTemplates = sortedTemplates.filter((t) => !t.is_active)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{student.name}</h3>
              {student.grade && (
                <Badge variant="outline">{student.grade}</Badge>
              )}
              {student.student_number && (
                <span className="text-sm text-muted-foreground">No.{student.student_number}</span>
              )}
            </div>
            {latestContract && (
              <p className="text-sm text-muted-foreground mt-1">
                契約期間: {latestContract.start_date} 〜 {latestContract.end_date}
                {activeContracts.length > 0 ? (
                  <Badge variant="default" className="ml-2 text-xs">契約中</Badge>
                ) : (
                  <Badge variant="secondary" className="ml-2 text-xs">期間外</Badge>
                )}
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-sm text-muted-foreground">
              {activeTemplates.length}件の授業
            </span>
          </div>
        </div>

        {activeTemplates.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">曜日</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">時間帯</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">講師</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">科目</th>
                </tr>
              </thead>
              <tbody>
                {activeTemplates.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0">
                    <td className="py-1.5 px-2 font-medium">{DAYS[t.day_of_week]}曜</td>
                    <td className="py-1.5 px-2">
                      {t.time_slot ? `${t.time_slot.label}（${t.time_slot.start_time.slice(0, 5)}〜${t.time_slot.end_time.slice(0, 5)}）` : '-'}
                    </td>
                    <td className="py-1.5 px-2">{t.teacher?.display_name || '-'}</td>
                    <td className="py-1.5 px-2">
                      {t.subject ? (
                        <Badge variant="secondary" className="text-xs">{t.subject.name}</Badge>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {inactiveTemplates.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1">非アクティブ ({inactiveTemplates.length}件)</p>
            <div className="flex flex-wrap gap-1">
              {inactiveTemplates.map((t) => (
                <Badge key={t.id} variant="outline" className="text-xs opacity-50">
                  {DAYS[t.day_of_week]}曜 {t.time_slot?.label || ''} {t.subject?.name || ''}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

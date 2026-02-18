'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports?limit=50')
      .then(res => res.json())
      .then(json => { setReports(json.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">読み込み中...</p></div>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">レポート一覧</h2>

      {reports.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">レポートがありません</CardContent></Card>
      ) : (
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
      )}
    </div>
  )
}

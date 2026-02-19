'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ReportForm } from '@/components/reports/report-form'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function ReportEditPage() {
  const params = useParams()
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReport = async () => {
      const res = await fetch(`/api/reports/${params.id}`)
      const json = await res.json()
      const r = json.data
      if (r) {
        setInitialData({
          student_id: r.student?.id || '',
          lesson_date: r.lesson_date,
          subject_id: r.subject?.id || '',
          textbooks: r.report_textbooks?.length
            ? r.report_textbooks.map((t: { textbook_name: string; pages: string | null }) => ({
                textbook_name: t.textbook_name,
                pages: t.pages || '',
              }))
            : [{ textbook_name: '', pages: '' }],
          unit_covered: r.unit_covered,
          homework_check: r.homework_check,
          positive_attitudes: r.report_attitudes
            ?.filter((a: { attitude_option: { category: string } }) => a.attitude_option.category === 'positive')
            .map((a: { attitude_option: { id: string } }) => a.attitude_option.id) || [],
          negative_attitudes: r.report_attitudes
            ?.filter((a: { attitude_option: { category: string } }) => a.attitude_option.category === 'negative')
            .map((a: { attitude_option: { id: string } }) => a.attitude_option.id) || [],
          strengths: r.strengths || '',
          weaknesses: r.weaknesses || '',
          free_comment: r.free_comment || '',
          homework_assigned: r.homework_assigned,
          next_lesson_plan: r.next_lesson_plan || '',
          internal_notes: r.internal_notes || '',
        })
      }
      setLoading(false)
    }
    fetchReport()
  }, [params.id])

  if (loading) {
    return <LoadingSpinner />
  }

  if (!initialData) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">レポートが見つかりません</p></div>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">レポート編集</h2>
      <ReportForm initialData={initialData} reportId={params.id as string} />
    </div>
  )
}

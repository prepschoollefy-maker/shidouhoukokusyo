'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ReportContent } from '@/components/ui/report-content'
import { GraduationCap } from 'lucide-react'

interface SummaryView {
  content: string
  period_start: string
  period_end: string
  created_at: string
  student: { name: string; grade: string | null }
  school_name: string
}

export default function SummaryViewPage() {
  const params = useParams()
  const [summary, setSummary] = useState<SummaryView | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/summaries/view/${params.token}`)
      .then(res => {
        if (!res.ok) { setNotFound(true); setLoading(false); return null }
        return res.json()
      })
      .then(json => {
        if (json) { setSummary(json.data); setLoading(false) }
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [params.token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (notFound || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">ページが見つかりません</h1>
          <p className="text-gray-500 mb-6 text-sm">このリンクは無効か、レポートが削除された可能性があります。</p>
          <div className="bg-white rounded-xl border p-4 text-sm text-gray-600 shadow-sm">
            <p className="font-medium mb-1">お問い合わせ</p>
            <p>ご不明な点がございましたら、塾までお気軽にお問い合わせください。</p>
          </div>
        </div>
      </div>
    )
  }

  const periodStr = `${format(new Date(summary.period_start), 'yyyy年M月d日', { locale: ja })} 〜 ${format(new Date(summary.period_end), 'M月d日', { locale: ja })}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-500" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative max-w-2xl mx-auto px-5 py-8">
          <p className="text-indigo-200 text-sm font-medium">{summary.school_name}</p>
          <h1 className="text-xl font-bold text-white mt-2">
            {summary.student.name}さんの学習レポート
          </h1>
          <p className="text-indigo-200 text-sm mt-1.5">{periodStr}</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 -mt-2">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 md:p-7">
          <ReportContent content={summary.content} />
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <GraduationCap className="h-4 w-4" />
          <p className="text-xs">{summary.school_name}</p>
        </div>
      </footer>
    </div>
  )
}

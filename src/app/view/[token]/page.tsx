'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (notFound || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">📄</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">ページが見つかりません</h1>
          <p className="text-gray-500 mb-6">このリンクは無効か、レポートが削除された可能性があります。</p>
          <div className="bg-white rounded-lg border p-4 text-sm text-gray-600">
            <p className="font-medium mb-1">お問い合わせ</p>
            <p>レポートについてご不明な点がございましたら、塾までお気軽にお問い合わせください。</p>
          </div>
        </div>
      </div>
    )
  }

  // Parse content into sections
  const sections = parseSections(summary.content)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <p className="text-sm text-blue-600 font-medium">{summary.school_name}</p>
          <h1 className="text-xl font-bold text-gray-900 mt-1">
            {summary.student.name}さんの学習レポート
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {format(new Date(summary.period_start), 'yyyy年M月d日', { locale: ja })}
            {' 〜 '}
            {format(new Date(summary.period_end), 'M月d日', { locale: ja })}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {sections.length > 0 ? (
          <div className="space-y-4">
            {sections.map((section, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border p-5">
                {section.title && (
                  <h2 className="text-base font-bold text-gray-800 mb-3 pb-2 border-b border-blue-100">
                    {section.title}
                  </h2>
                )}
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {section.body}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-5">
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {summary.content}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-400">
          {summary.school_name} 学習レポート
        </p>
      </footer>
    </div>
  )
}

function parseSections(content: string): { title: string; body: string }[] {
  // Match 【...】 section headers
  const regex = /【([^】]+)】/g
  const parts: { title: string; body: string }[] = []
  let lastIndex = 0
  let match

  const matches: { title: string; index: number }[] = []
  while ((match = regex.exec(content)) !== null) {
    matches.push({ title: match[1], index: match.index })
  }

  if (matches.length === 0) return []

  // Text before first section
  const preamble = content.slice(0, matches[0].index).trim()
  if (preamble) {
    parts.push({ title: '', body: preamble })
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].title.length + 2 // skip 【title】
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length
    const body = content.slice(start, end).trim()
    parts.push({ title: matches[i].title, body })
  }

  return parts
}

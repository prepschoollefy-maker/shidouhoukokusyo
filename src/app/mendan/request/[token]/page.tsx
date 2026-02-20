'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface TokenInfo {
  student_name: string
  period_label: string
  school_name: string
  already_submitted: boolean
}

export default function MendanRequestPage() {
  const params = useParams()
  const [info, setInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [candidate1, setCandidate1] = useState('')
  const [candidate2, setCandidate2] = useState('')
  const [candidate3, setCandidate3] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`/api/mendan/requests/${params.token}`)
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json()
          setError(json.error || 'エラーが発生しました')
          setLoading(false)
          return
        }
        const json = await res.json()
        setInfo(json.data)
        if (json.data.already_submitted) {
          setSubmitted(true)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('通信エラーが発生しました')
        setLoading(false)
      })
  }, [params.token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!candidate1 || !candidate2 || !candidate3) {
      setError('3つの希望日時を入力してください')
      return
    }
    if (submitting) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/mendan/requests/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate1: new Date(candidate1).toISOString(),
          candidate2: new Date(candidate2).toISOString(),
          candidate3: new Date(candidate3).toISOString(),
          message: message || null,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error || '送信に失敗しました')
        setSubmitting(false)
        return
      }

      setSubmitted(true)
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (error && !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">📅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">アクセスできません</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <div className="bg-white rounded-lg border p-4 text-sm text-gray-600">
            <p className="font-medium mb-1">お問い合わせ</p>
            <p>面談についてご不明な点がございましたら、塾までお気軽にお問い合わせください。</p>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">ご回答ありがとうございます</h1>
          <p className="text-gray-500 mb-6">
            {info?.student_name}さんの面談希望日を受け付けました。<br />
            日程が確定しましたらご連絡いたします。
          </p>
          <div className="bg-white rounded-lg border p-4 text-sm text-gray-600">
            <p>{info?.school_name}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-6">
          <p className="text-sm text-blue-600 font-medium">{info?.school_name}</p>
          <h1 className="text-xl font-bold text-gray-900 mt-1">面談希望日の入力</h1>
          <p className="text-sm text-gray-500 mt-1">
            {info?.student_name}さん / {info?.period_label}
          </p>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-5">
            <p className="text-sm text-gray-600">
              面談のご希望日時を3つご入力ください。日程を調整の上、改めてご連絡いたします。
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  第1希望 <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={candidate1}
                  onChange={(e) => setCandidate1(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  第2希望 <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={candidate2}
                  onChange={(e) => setCandidate2(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  第3希望 <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={candidate3}
                  onChange={(e) => setCandidate3(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メッセージ（任意）
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="ご要望やご質問がありましたらご記入ください"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '送信中...' : '送信する'}
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-400">
          {info?.school_name}
        </p>
      </footer>
    </div>
  )
}

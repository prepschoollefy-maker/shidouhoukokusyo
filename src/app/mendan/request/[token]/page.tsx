'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface TokenInfo {
  student_name: string
  period_label: string
  school_name: string
  already_submitted: boolean
  existing_request?: {
    candidate1: string
    candidate2: string
    candidate3: string
    candidate1_end: string | null
    candidate2_end: string | null
    candidate3_end: string | null
    message: string | null
  }
}

// 曜日に応じた時間帯オプションを返す
function getTimeSlots(dateStr: string): string[] {
  if (!dateStr) return []
  const date = new Date(dateStr + 'T00:00:00')
  const day = date.getDay() // 0=日, 6=土
  const isWeekend = day === 0 || day === 6

  if (isWeekend) {
    // 土日: 13:00〜19:00 (7種類)
    return ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']
  } else {
    // 平日: 13:00〜20:00 (8種類)
    return ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
  }
}

function getDayLabel(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  const day = date.getDay()
  const isWeekend = day === 0 || day === 6
  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  return `${dayNames[day]}曜日${isWeekend ? '（13:00〜19:00）' : '（13:00〜20:00）'}`
}

// 日付と時間を組み合わせてISO文字列にする
function combineDateTime(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) return ''
  return new Date(`${dateStr}T${timeStr}:00`).toISOString()
}

// 「から」の時間以降の選択肢を返す（「まで」用）
function getEndTimeSlots(dateStr: string, fromTime: string): string[] {
  const allSlots = getTimeSlots(dateStr)
  if (!fromTime) return allSlots
  const fromIndex = allSlots.indexOf(fromTime)
  if (fromIndex === -1) return allSlots
  // fromの次の時刻以降を返す（同じ時刻は不可）
  return allSlots.slice(fromIndex + 1)
}

function CandidateInput({
  label,
  date,
  fromTime,
  toTime,
  onDateChange,
  onFromTimeChange,
  onToTimeChange,
}: {
  label: string
  date: string
  fromTime: string
  toTime: string
  onDateChange: (v: string) => void
  onFromTimeChange: (v: string) => void
  onToTimeChange: (v: string) => void
}) {
  const timeSlots = getTimeSlots(date)
  const endSlots = getEndTimeSlots(date, fromTime)
  const dayLabel = getDayLabel(date)

  // 日付変更時に時間帯をリセット（選択肢が変わるため）
  const handleDateChange = (newDate: string) => {
    onDateChange(newDate)
    const newSlots = getTimeSlots(newDate)
    if (fromTime && !newSlots.includes(fromTime)) {
      onFromTimeChange('')
      onToTimeChange('')
    }
  }

  // 開始時刻変更時に終了時刻をリセット
  const handleFromChange = (newFrom: string) => {
    onFromTimeChange(newFrom)
    // 終了が開始以前なら終了をリセット
    const newEndSlots = getEndTimeSlots(date, newFrom)
    if (toTime && !newEndSlots.includes(toTime)) {
      onToTimeChange('')
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="space-y-2">
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex items-center gap-2">
          <select
            value={fromTime}
            onChange={(e) => handleFromChange(e.target.value)}
            required
            disabled={!date}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">開始</option>
            {timeSlots.map(slot => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500 shrink-0">〜</span>
          <select
            value={toTime}
            onChange={(e) => onToTimeChange(e.target.value)}
            required
            disabled={!fromTime}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">終了</option>
            {endSlots.map(slot => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
        </div>
      </div>
      {date && (
        <p className="text-xs text-gray-400 mt-1">{dayLabel}</p>
      )}
    </div>
  )
}

export default function MendanRequestPage() {
  const params = useParams()
  const [info, setInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [date1, setDate1] = useState('')
  const [from1, setFrom1] = useState('')
  const [to1, setTo1] = useState('')
  const [date2, setDate2] = useState('')
  const [from2, setFrom2] = useState('')
  const [to2, setTo2] = useState('')
  const [date3, setDate3] = useState('')
  const [from3, setFrom3] = useState('')
  const [to3, setTo3] = useState('')
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
          setAlreadySubmitted(true)
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
    if (!date1 || !from1 || !to1 || !date2 || !from2 || !to2 || !date3 || !from3 || !to3) {
      setError('3つの希望日時（日付・開始・終了）をすべて入力してください')
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
          candidate1: combineDateTime(date1, from1),
          candidate1_end: combineDateTime(date1, to1),
          candidate2: combineDateTime(date2, from2),
          candidate2_end: combineDateTime(date2, to2),
          candidate3: combineDateTime(date3, from3),
          candidate3_end: combineDateTime(date3, to3),
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

  if (alreadySubmitted && !showForm) {
    const ex = info?.existing_request
    const fmtDateTime = (iso: string | null | undefined) => {
      if (!iso) return ''
      const d = new Date(iso)
      const mm = d.getMonth() + 1
      const dd = d.getDate()
      const dayNames = ['日', '月', '火', '水', '木', '金', '土']
      const hh = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `${mm}/${dd}（${dayNames[d.getDay()]}）${hh}:${min}`
    }
    const fmtRange = (start: string | null | undefined, end: string | null | undefined) => {
      if (!start) return '—'
      const s = fmtDateTime(start)
      const e = end ? new Date(end) : null
      if (e) {
        return `${s}〜${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`
      }
      return s
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">📅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">既にご回答いただいています</h1>
          <p className="text-gray-500 mb-4">
            {info?.student_name}さんの面談希望日は受付済みです。
          </p>
          {ex && (
            <div className="bg-white rounded-lg border p-4 text-sm text-left mb-4 space-y-1">
              <p><span className="font-medium text-gray-700">第1希望:</span> {fmtRange(ex.candidate1, ex.candidate1_end)}</p>
              <p><span className="font-medium text-gray-700">第2希望:</span> {fmtRange(ex.candidate2, ex.candidate2_end)}</p>
              <p><span className="font-medium text-gray-700">第3希望:</span> {fmtRange(ex.candidate3, ex.candidate3_end)}</p>
              {ex.message && <p className="text-gray-500 mt-2 text-xs">メッセージ: {ex.message}</p>}
            </div>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-gray-600 text-white py-3 rounded-lg font-medium text-sm hover:bg-gray-700 transition-colors"
          >
            回答を修正する
          </button>
          <div className="bg-white rounded-lg border p-4 text-sm text-gray-600 mt-4">
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

            <div className="bg-blue-50 rounded-md p-3 text-xs text-blue-700 space-y-0.5">
              <p className="font-medium">選択可能な時間帯</p>
              <p>平日（月〜金）: 13:00〜20:00</p>
              <p>土日: 13:00〜19:00</p>
            </div>

            <div className="space-y-5">
              <CandidateInput
                label="第1希望"
                date={date1} fromTime={from1} toTime={to1}
                onDateChange={setDate1} onFromTimeChange={setFrom1} onToTimeChange={setTo1}
              />
              <CandidateInput
                label="第2希望"
                date={date2} fromTime={from2} toTime={to2}
                onDateChange={setDate2} onFromTimeChange={setFrom2} onToTimeChange={setTo2}
              />
              <CandidateInput
                label="第3希望"
                date={date3} fromTime={from3} toTime={to3}
                onDateChange={setDate3} onFromTimeChange={setFrom3} onToTimeChange={setTo3}
              />
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

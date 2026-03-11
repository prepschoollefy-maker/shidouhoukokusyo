'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface Period {
  id: string
  label: string
  start_date: string
  end_date: string
  student_deadline: string | null
}

interface TimeSlot {
  id: string
  slot_number: number
  label: string
  start_time: string
  end_time: string
}

const SUBJECT_LIST = ['算数・数学', '英語', '国語（現代文・古文・漢文）', '理科（物理・化学・生物）', '社会（世界史・日本史・地理）']

function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`
}

function formatSlotTime(slot: TimeSlot): string {
  return `${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`
}

export default function StudentSchedulingForm() {
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [period, setPeriod] = useState<Period | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set())

  const [studentNumber, setStudentNumber] = useState('')
  const [studentName, setStudentName] = useState('')
  const [subjects, setSubjects] = useState<Record<string, number>>({})
  const [ngSlots, setNgSlots] = useState<Set<string>>(new Set()) // "date|slotId" or "date|all"
  const [note, setNote] = useState('')

  useEffect(() => {
    fetch(`/api/lecture-scheduling/requests/${params.token}`)
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json()
          setError(json.error || 'エラーが発生しました')
          return
        }
        const json = await res.json()
        setPeriod(json.period)
        setTimeSlots(json.timeSlots)
        setClosedDates(new Set(json.closedDates || []))
      })
      .catch(() => setError('通信エラーが発生しました'))
      .finally(() => setLoading(false))
  }, [params.token])

  const dates = period ? generateDateRange(period.start_date, period.end_date) : []

  const toggleNg = useCallback((dateStr: string, slotId: string | null) => {
    setNgSlots(prev => {
      const next = new Set(prev)
      if (slotId === null) {
        const key = `${dateStr}|all`
        if (next.has(key)) {
          next.delete(key)
          timeSlots.forEach(s => next.delete(`${dateStr}|${s.id}`))
        } else {
          next.add(key)
          timeSlots.forEach(s => next.add(`${dateStr}|${s.id}`))
        }
      } else {
        const key = `${dateStr}|${slotId}`
        if (next.has(key)) {
          next.delete(key)
          next.delete(`${dateStr}|all`)
        } else {
          next.add(key)
          const allSelected = timeSlots.every(s => next.has(`${dateStr}|${s.id}`))
          if (allSelected) next.add(`${dateStr}|all`)
        }
      }
      return next
    })
  }, [timeSlots])

  const handleSubjectChange = (subject: string, value: string) => {
    const num = parseInt(value) || 0
    setSubjects(prev => {
      const next = { ...prev }
      if (num > 0) next[subject] = num
      else delete next[subject]
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentNumber.trim()) { setError('塾生番号を入力してください'); return }
    if (!studentName.trim()) { setError('氏名を入力してください'); return }
    const totalLessons = Object.values(subjects).reduce((a, b) => a + b, 0)
    if (totalLessons === 0) { setError('科目ごとの希望コマ数を1つ以上入力してください'); return }

    setSubmitting(true)
    setError('')

    // NGスロットをAPI用に変換
    const ngSlotsArray: { ng_date: string; time_slot_id: string | null }[] = []
    const processedDates = new Set<string>()

    ngSlots.forEach(key => {
      const [dateStr, slotPart] = key.split('|')
      if (slotPart === 'all') {
        if (!processedDates.has(dateStr)) {
          ngSlotsArray.push({ ng_date: dateStr, time_slot_id: null })
          processedDates.add(dateStr)
        }
      }
    })
    ngSlots.forEach(key => {
      const [dateStr, slotPart] = key.split('|')
      if (slotPart !== 'all' && !processedDates.has(dateStr)) {
        ngSlotsArray.push({ ng_date: dateStr, time_slot_id: slotPart })
      }
    })

    try {
      const res = await fetch(`/api/lecture-scheduling/requests/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_number: studentNumber.trim(),
          student_name: studentName.trim(),
          subjects,
          ng_slots: ngSlotsArray,
          note: note || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || '送信に失敗しました')
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

  if (error && !period) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">アクセスできません</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">送信完了</h1>
          <p className="text-gray-500">
            ご回答ありがとうございます。日程が決まりましたらご連絡いたします。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <p className="text-sm text-blue-600 font-medium">レフィー</p>
          <h1 className="text-xl font-bold text-gray-900 mt-1">講習希望入力</h1>
          <p className="text-sm text-gray-500 mt-1">{period?.label}</p>
          {period?.student_deadline && (
            <p className="text-xs text-orange-600 mt-1">
              回答期限: {new Date(period.student_deadline).toLocaleDateString('ja-JP')}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 生徒情報（手入力） */}
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">生徒情報</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  塾生番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={studentNumber}
                  onChange={e => setStudentNumber(e.target.value)}
                  placeholder="例: 001"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="例: 山田太郎"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">塾生番号と氏名の組み合わせで本人確認を行います。</p>
          </div>

          {/* 科目・コマ数 */}
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">
              希望科目・コマ数 <span className="text-red-500 text-sm">*</span>
            </h2>
            <p className="text-sm text-gray-500">受講したい科目のコマ数を入力してください。</p>
            <div className="space-y-3">
              {SUBJECT_LIST.map(subject => (
                <div key={subject} className="flex items-center gap-3">
                  <label className="text-sm text-gray-700 min-w-0 flex-1">{subject}</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={subjects[subject] || ''}
                    onChange={e => handleSubjectChange(subject, e.target.value)}
                    placeholder="0"
                    className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-center shrink-0"
                  />
                  <span className="text-xs text-gray-400 shrink-0">コマ</span>
                </div>
              ))}
            </div>
          </div>

          {/* NG日時グリッド */}
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">NG日時</h2>
            <p className="text-sm text-gray-500">
              参加できない日時をタップしてください。選択されたコマは赤くなります。
            </p>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white z-10 px-2 py-1 border text-left min-w-[80px]">日付</th>
                    {timeSlots.map(slot => (
                      <th key={slot.id} className="px-1 py-1 border text-center min-w-[60px] whitespace-nowrap">
                        {formatSlotTime(slot)}
                      </th>
                    ))}
                    <th className="px-2 py-1 border text-center min-w-[50px]">終日</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map(dateStr => {
                    const isAllDay = ngSlots.has(`${dateStr}|all`)
                    const isClosed = closedDates.has(dateStr)
                    const dow = new Date(dateStr + 'T00:00:00').getDay()
                    const isWeekend = dow === 0 || dow === 6
                    return (
                      <tr key={dateStr} className={isClosed ? 'bg-gray-200/60' : isWeekend ? 'bg-blue-50/50' : ''}>
                        <td className={`sticky left-0 z-10 px-2 py-1.5 border font-medium whitespace-nowrap ${isClosed ? 'bg-gray-200' : 'bg-white'}`}>
                          {formatDate(dateStr)}
                          {isClosed && <span className="ml-1 text-[10px] text-gray-500">休館</span>}
                        </td>
                        {isClosed ? (
                          <td colSpan={timeSlots.length + 1} className="px-1 py-1.5 border text-center text-xs text-gray-400">
                            休館日
                          </td>
                        ) : (
                          <>
                        {timeSlots.map(slot => {
                          const isNg = ngSlots.has(`${dateStr}|${slot.id}`)
                          return (
                            <td key={slot.id} className="px-1 py-1 border text-center">
                              <button
                                type="button"
                                onClick={() => toggleNg(dateStr, slot.id)}
                                className={`w-full py-1.5 rounded text-xs transition-colors ${
                                  isNg
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {isNg ? 'NG' : '-'}
                              </button>
                            </td>
                          )
                        })}
                        <td className="px-1 py-1 border text-center">
                          <button
                            type="button"
                            onClick={() => toggleNg(dateStr, null)}
                            className={`w-full py-1.5 rounded text-xs transition-colors ${
                              isAllDay
                                ? 'bg-red-700 text-white'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            {isAllDay ? '終日' : '-'}
                          </button>
                        </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 自由記入 */}
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">その他・要望</h2>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="希望や要望があればご記入ください"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none"
            />
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

      <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-400">レフィー</p>
      </footer>
    </div>
  )
}

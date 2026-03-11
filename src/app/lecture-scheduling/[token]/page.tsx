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

interface Student {
  id: string
  name: string
  student_number: string
  grade: string
}

interface TimeSlot {
  id: string
  slot_number: number
  label: string
  start_time: string
  end_time: string
}

const SUBJECT_LIST = ['算数・数学', '英語', '国語', '理科', '社会']

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
  const [students, setStudents] = useState<Student[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [submittedStudentIds, setSubmittedStudentIds] = useState<string[]>([])

  const [selectedStudent, setSelectedStudent] = useState('')
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
        setStudents(json.students)
        setTimeSlots(json.timeSlots)
        setSubmittedStudentIds(json.submittedStudentIds)
      })
      .catch(() => setError('通信エラーが発生しました'))
      .finally(() => setLoading(false))
  }, [params.token])

  const dates = period ? generateDateRange(period.start_date, period.end_date) : []

  const toggleNg = useCallback((dateStr: string, slotId: string | null) => {
    setNgSlots(prev => {
      const next = new Set(prev)
      if (slotId === null) {
        // 終日NG toggle
        const key = `${dateStr}|all`
        if (next.has(key)) {
          // 終日NG解除 → この日の個別スロットも全削除
          next.delete(key)
          timeSlots.forEach(s => next.delete(`${dateStr}|${s.id}`))
        } else {
          // 終日NGに設定 → 個別スロットも全選択
          next.add(key)
          timeSlots.forEach(s => next.add(`${dateStr}|${s.id}`))
        }
      } else {
        const key = `${dateStr}|${slotId}`
        if (next.has(key)) {
          next.delete(key)
          next.delete(`${dateStr}|all`) // 終日フラグ解除
        } else {
          next.add(key)
          // 全スロット選択されたら終日にする
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
    if (!selectedStudent) { setError('生徒を選択してください'); return }
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
    // 終日NGでない日の個別スロット
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
          student_id: selectedStudent,
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

  const selectedStudentObj = students.find(s => s.id === selectedStudent)
  const isResubmission = submittedStudentIds.includes(selectedStudent)

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
          {/* 生徒選択 */}
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">生徒情報</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                生徒氏名 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedStudent}
                onChange={e => setSelectedStudent(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.student_number} {s.name}（{s.grade}）
                  </option>
                ))}
              </select>
              {isResubmission && (
                <p className="text-xs text-orange-600 mt-1">
                  既に回答済みです。送信すると前回の回答が上書きされます。
                </p>
              )}
            </div>
          </div>

          {/* 科目・コマ数 */}
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">
              希望科目・コマ数 <span className="text-red-500 text-sm">*</span>
            </h2>
            <p className="text-sm text-gray-500">受講したい科目のコマ数を入力してください。</p>
            <div className="grid grid-cols-2 gap-3">
              {SUBJECT_LIST.map(subject => (
                <div key={subject} className="flex items-center gap-2">
                  <label className="text-sm text-gray-700 w-20 shrink-0">{subject}</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={subjects[subject] || ''}
                    onChange={e => handleSubjectChange(subject, e.target.value)}
                    placeholder="0"
                    className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-center"
                  />
                  <span className="text-xs text-gray-400">コマ</span>
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
                    const dow = new Date(dateStr + 'T00:00:00').getDay()
                    const isWeekend = dow === 0 || dow === 6
                    return (
                      <tr key={dateStr} className={isWeekend ? 'bg-blue-50/50' : ''}>
                        <td className="sticky left-0 bg-white z-10 px-2 py-1.5 border font-medium whitespace-nowrap">
                          {formatDate(dateStr)}
                        </td>
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
            {submitting ? '送信中...' : isResubmission ? '回答を更新する' : '送信する'}
          </button>
        </form>
      </main>

      <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-400">レフィー</p>
      </footer>
    </div>
  )
}

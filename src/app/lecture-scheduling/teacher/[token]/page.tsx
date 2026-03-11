'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface Period {
  id: string
  label: string
  start_date: string
  end_date: string
}

interface TimeSlot {
  id: string
  slot_number: number
  label: string
  start_time: string
  end_time: string
}

interface NgSlot {
  ng_date: string
  time_slot_id: string | null
}

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

export default function TeacherSchedulingResponse() {
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [period, setPeriod] = useState<Period | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set())
  const [studentName, setStudentName] = useState('')
  const [studentGrade, setStudentGrade] = useState('')
  const [subjects, setSubjects] = useState<Record<string, number>>({})
  const [studentNote, setStudentNote] = useState('')
  const [ngSet, setNgSet] = useState<Set<string>>(new Set())
  const [ngAllDays, setNgAllDays] = useState<Set<string>>(new Set())
  const [teacherName, setTeacherName] = useState('')
  const [isResubmission, setIsResubmission] = useState(false)

  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set()) // "date|slotId"

  useEffect(() => {
    fetch(`/api/lecture-scheduling/teacher/${params.token}`)
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
        setStudentName(json.student.name)
        setStudentGrade(json.student.grade)
        setSubjects(json.subjects)
        setStudentNote(json.studentNote || '')
        setTeacherName(json.teacher?.display_name || '')

        // NG slots
        const ngs = new Set<string>()
        const ngAllDaySet = new Set<string>()
        ;(json.ngSlots as NgSlot[]).forEach(s => {
          if (s.time_slot_id === null) {
            ngAllDaySet.add(s.ng_date)
            // 終日NGの場合は全スロットをNGに
            json.timeSlots.forEach((ts: TimeSlot) => ngs.add(`${s.ng_date}|${ts.id}`))
          } else {
            ngs.add(`${s.ng_date}|${s.time_slot_id}`)
          }
        })
        setNgSet(ngs)
        setNgAllDays(ngAllDaySet)

        // 既存回答の復元
        if (json.existingResponses && json.existingResponses.length > 0) {
          setIsResubmission(true)
          const existing = new Set<string>()
          json.existingResponses.forEach((r: { available_date: string; time_slot_id: string }) => {
            existing.add(`${r.available_date}|${r.time_slot_id}`)
          })
          setSelectedSlots(existing)
        }
      })
      .catch(() => setError('通信エラーが発生しました'))
      .finally(() => setLoading(false))
  }, [params.token])

  const dates = period ? generateDateRange(period.start_date, period.end_date) : []

  const toggleSlot = useCallback((dateStr: string, slotId: string) => {
    const key = `${dateStr}|${slotId}`
    if (ngSet.has(key) || ngAllDays.has(dateStr)) return // NGのコマは選択不可
    setSelectedSlots(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [ngSet, ngAllDays])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedSlots.size === 0) {
      setError('担当可能なコマを1つ以上選択してください')
      return
    }
    setSubmitting(true)
    setError('')

    const available_slots = Array.from(selectedSlots).map(key => {
      const [available_date, time_slot_id] = key.split('|')
      return { available_date, time_slot_id }
    })

    try {
      const res = await fetch(`/api/lecture-scheduling/teacher/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available_slots }),
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">回答を送信しました</h1>
          <p className="text-gray-500">ご協力ありがとうございます。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <p className="text-sm text-green-600 font-medium">レフィー 講習日程調整</p>
          <h1 className="text-xl font-bold text-gray-900 mt-1">担当可能日時の回答</h1>
          <p className="text-sm text-gray-500 mt-1">{period?.label}</p>
          {teacherName && <p className="text-sm text-gray-500">{teacherName} 先生</p>}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 生徒情報 */}
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">対象生徒</h2>
            <div className="text-sm space-y-1">
              <p><span className="text-gray-500">生徒名:</span> {studentName}（{studentGrade}）</p>
              <p><span className="text-gray-500">希望科目・コマ数:</span></p>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(subjects).map(([subject, count]) => (
                  <span key={subject} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">
                    {subject}: {count}コマ
                  </span>
                ))}
              </div>
              {studentNote && (
                <p className="text-gray-500 text-xs mt-2">要望: {studentNote}</p>
              )}
            </div>
          </div>

          {/* 説明 */}
          <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-sm text-green-800">
            <p className="font-medium mb-1">回答方法</p>
            <p>赤いセル（NG）以外で、担当可能なコマをタップして緑にしてください。</p>
            {isResubmission && (
              <p className="mt-1 text-orange-700">前回の回答が復元されています。修正して再送信できます。</p>
            )}
          </div>

          {/* 日程グリッド */}
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">日程表</h2>
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
                  </tr>
                </thead>
                <tbody>
                  {dates.map(dateStr => {
                    const isAllDayNg = ngAllDays.has(dateStr)
                    const isClosed = closedDates.has(dateStr)
                    const dow = new Date(dateStr + 'T00:00:00').getDay()
                    const isWeekend = dow === 0 || dow === 6
                    return (
                      <tr key={dateStr} className={isClosed ? 'bg-gray-200/60' : isWeekend ? 'bg-blue-50/50' : ''}>
                        <td className={`sticky left-0 z-10 px-2 py-1.5 border font-medium whitespace-nowrap ${isClosed ? 'bg-gray-200' : 'bg-white'}`}>
                          {formatDate(dateStr)}
                          {isClosed && <span className="ml-1 text-[10px] text-gray-500">休館</span>}
                          {!isClosed && isAllDayNg && <span className="ml-1 text-red-500 text-[10px]">終日NG</span>}
                        </td>
                        {isClosed ? (
                          <td colSpan={timeSlots.length} className="px-1 py-1.5 border text-center text-xs text-gray-400">
                            休館日
                          </td>
                        ) : (
                          <>
                        {timeSlots.map(slot => {
                          const key = `${dateStr}|${slot.id}`
                          const isNg = ngSet.has(key) || isAllDayNg
                          const isSelected = selectedSlots.has(key)
                          return (
                            <td key={slot.id} className="px-1 py-1 border text-center">
                              {isNg ? (
                                <div className="w-full py-1.5 rounded text-xs bg-red-100 text-red-400">
                                  NG
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleSlot(dateStr, slot.id)}
                                  className={`w-full py-1.5 rounded text-xs transition-colors ${
                                    isSelected
                                      ? 'bg-green-500 text-white'
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  }`}
                                >
                                  {isSelected ? 'OK' : '-'}
                                </button>
                              )}
                            </td>
                          )
                        })}
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '送信中...' : isResubmission ? '回答を更新する' : '回答を送信する'}
          </button>
        </form>
      </main>

      <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-400">レフィー</p>
      </footer>
    </div>
  )
}

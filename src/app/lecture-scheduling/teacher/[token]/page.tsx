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

interface ComiruLesson {
  lesson_date: string
  start_time: string
  student_name: string | null
}

function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (current <= end) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const day = String(current.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${day}`)
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
  const [isPresetFromOther, setIsPresetFromOther] = useState(false)
  const [comiruLessons, setComiruLessons] = useState<ComiruLesson[]>([])

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
        setComiruLessons(json.comiruLessons || [])

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

        // comiru授業ありの枠セット
        const comiruSet = new Set<string>()
        ;(json.comiruLessons || []).forEach((l: { lesson_date: string; start_time: string }) => {
          const matchSlot = json.timeSlots.find((ts: TimeSlot) => ts.start_time.slice(0, 5) === l.start_time.slice(0, 5))
          if (matchSlot) comiruSet.add(`${l.lesson_date}|${matchSlot.id}`)
        })

        // 既存回答の復元（comiru授業ありの枠は除外）
        if (json.existingResponses && json.existingResponses.length > 0) {
          setIsResubmission(true)
          const existing = new Set<string>()
          json.existingResponses.forEach((r: { available_date: string; time_slot_id: string }) => {
            const key = `${r.available_date}|${r.time_slot_id}`
            if (!comiruSet.has(key)) existing.add(key)
          })
          setSelectedSlots(existing)
        } else if (json.otherTeacherResponses && json.otherTeacherResponses.length > 0) {
          // 他の生徒への回答からプリセット（NG・comiru枠は除外）
          setIsPresetFromOther(true)
          const preset = new Set<string>()
          json.otherTeacherResponses.forEach((r: { available_date: string; time_slot_id: string }) => {
            const key = `${r.available_date}|${r.time_slot_id}`
            if (!comiruSet.has(key) && !ngs.has(key) && !ngAllDaySet.has(r.available_date)) {
              preset.add(key)
            }
          })
          setSelectedSlots(preset)
        }
      })
      .catch(() => setError('通信エラーが発生しました'))
      .finally(() => setLoading(false))
  }, [params.token])

  const dates = period ? generateDateRange(period.start_date, period.end_date) : []

  // comiru授業があるか判定
  const getComiruInfo = useCallback((dateStr: string, slot: TimeSlot): ComiruLesson[] => {
    const slotStart = slot.start_time.slice(0, 5)
    return comiruLessons.filter(l =>
      l.lesson_date === dateStr && l.start_time.slice(0, 5) === slotStart
    )
  }, [comiruLessons])

  // comiru授業があるスロットのSetを生成
  const comiruBusySet = new Set<string>()
  if (timeSlots.length > 0) {
    dates.forEach(dateStr => {
      timeSlots.forEach(slot => {
        if (getComiruInfo(dateStr, slot).length > 0) {
          comiruBusySet.add(`${dateStr}|${slot.id}`)
        }
      })
    })
  }

  const toggleSlot = useCallback((dateStr: string, slotId: string) => {
    const key = `${dateStr}|${slotId}`
    if (ngSet.has(key) || ngAllDays.has(dateStr)) return // NGのコマは選択不可
    if (comiruBusySet.has(key)) return // comiru授業ありのコマは選択不可
    setSelectedSlots(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [ngSet, ngAllDays, comiruBusySet])

  const selectAllAvailable = useCallback(() => {
    const allKeys = new Set<string>()
    dates.forEach(dateStr => {
      if (closedDates.has(dateStr)) return
      timeSlots.forEach(slot => {
        const key = `${dateStr}|${slot.id}`
        if (!ngSet.has(key) && !ngAllDays.has(dateStr) && !comiruBusySet.has(key)) {
          allKeys.add(key)
        }
      })
    })
    setSelectedSlots(allKeys)
  }, [dates, timeSlots, ngSet, ngAllDays, closedDates, comiruBusySet])

  const clearAllSelected = useCallback(() => {
    setSelectedSlots(new Set())
  }, [])

  const totalRequired = Object.values(subjects).reduce((a, b) => a + b, 0)

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
          <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-sm text-green-800 space-y-2">
            <p className="font-medium">回答方法</p>
            <p>担当<span className="underline underline-offset-2 font-medium">可能な</span>コマをタップして緑色にしてください。赤いセル（生徒NG）は選択できません。</p>
            <div className="flex items-center gap-3 text-xs text-green-700 pt-1">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-500" /> 担当OK</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-300" /> 通常授業あり（選択不可）</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" /> 生徒NG（選択不可）</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-300" /> 未選択</span>
            </div>
            {isResubmission && (
              <p className="text-orange-700 bg-orange-50 rounded px-2 py-1 text-xs">前回の回答が復元されています。修正して再送信できます。</p>
            )}
            {isPresetFromOther && (
              <p className="text-blue-700 bg-blue-50 rounded px-2 py-1 text-xs">他の生徒への回答からOK日時が自動セットされています。必要に応じて修正してください。</p>
            )}
          </div>

          {/* 選択状況 */}
          <div className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-gray-500">必要コマ数:</span>{' '}
                <span className="font-semibold">{totalRequired}コマ</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="text-gray-500">選択中:</span>{' '}
                <span className={`font-bold text-lg ${selectedSlots.size >= totalRequired ? 'text-green-600' : 'text-orange-600'}`}>
                  {selectedSlots.size}
                </span>
                <span className="text-gray-500 text-xs ml-0.5">コマ</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllAvailable}
                  className="text-xs px-3 py-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-medium"
                >
                  全てOK
                </button>
                <button
                  type="button"
                  onClick={clearAllSelected}
                  className="text-xs px-3 py-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  全解除
                </button>
              </div>
            </div>
            {/* プログレスバー */}
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${selectedSlots.size >= totalRequired ? 'bg-green-500' : 'bg-orange-400'}`}
                style={{ width: `${Math.min(100, totalRequired > 0 ? (selectedSlots.size / totalRequired) * 100 : 0)}%` }}
              />
            </div>
            {selectedSlots.size >= totalRequired ? (
              <p className="text-xs text-green-600 font-medium">必要コマ数以上を選択済みです。このまま送信できます。</p>
            ) : (
              <p className="text-xs text-orange-600">あと{totalRequired - selectedSlots.size}コマ以上選択してください（多めに選んでいただけると助かります）。</p>
            )}
          </div>

          {/* 日程グリッド: デスクトップ=テーブル, モバイル=カード */}
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">日程表</h2>

            {/* テーブル表示（md以上） */}
            <div className="hidden md:block overflow-x-auto -mx-5 px-5">
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
                          const comiruInfo = getComiruInfo(dateStr, slot)
                          const hasComiruLesson = comiruInfo.length > 0
                          return (
                            <td key={slot.id} className="px-1 py-1 border text-center">
                              {hasComiruLesson ? (
                                <div className="w-full py-1 rounded text-xs font-medium bg-orange-100 text-orange-600">
                                  <div className="text-[10px] text-orange-400">{comiruInfo.map(l => l.student_name || '').filter(Boolean).join(', ')}</div>
                                  <div>授業あり</div>
                                </div>
                              ) : isNg ? (
                                <div className="w-full py-1.5 rounded text-xs bg-red-100 text-red-400 font-medium">
                                  NG
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleSlot(dateStr, slot.id)}
                                  className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${
                                    isSelected
                                      ? 'bg-green-500 text-white shadow-sm'
                                      : 'bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-600 border border-gray-200'
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

            {/* カード表示（モバイル） */}
            <div className="md:hidden space-y-2 -mx-5 px-5">
              {dates.map(dateStr => {
                const isAllDayNg = ngAllDays.has(dateStr)
                const isClosed = closedDates.has(dateStr)
                const dow = new Date(dateStr + 'T00:00:00').getDay()
                const isWeekend = dow === 0 || dow === 6
                return (
                  <div key={dateStr} className={`rounded-lg border p-3 ${isClosed ? 'bg-gray-100' : isWeekend ? 'bg-blue-50/30' : 'bg-white'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">{formatDate(dateStr)}</span>
                      {isClosed && <span className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">休館</span>}
                      {!isClosed && isAllDayNg && <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">終日NG</span>}
                    </div>
                    {isClosed ? (
                      <p className="text-xs text-gray-400">休館日</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {timeSlots.map(slot => {
                          const key = `${dateStr}|${slot.id}`
                          const isNg = ngSet.has(key) || isAllDayNg
                          const isSelected = selectedSlots.has(key)
                          const comiruInfo = getComiruInfo(dateStr, slot)
                          const hasComiruLesson = comiruInfo.length > 0
                          return hasComiruLesson ? (
                            <div key={slot.id} className="py-1.5 rounded text-xs text-center font-medium bg-orange-100 text-orange-600">
                              <div className="text-[10px] text-orange-400">{formatSlotTime(slot)}</div>
                              <div className="text-[10px] text-orange-400">{comiruInfo.map(l => l.student_name || '').filter(Boolean).join(', ')}</div>
                              授業あり
                            </div>
                          ) : isNg ? (
                            <div key={slot.id} className="py-2 rounded text-xs bg-red-100 text-red-400 text-center font-medium">
                              <div className="text-[10px] text-red-300">{formatSlotTime(slot)}</div>
                              NG
                            </div>
                          ) : (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => toggleSlot(dateStr, slot.id)}
                              className={`py-2 rounded text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-green-500 text-white shadow-sm'
                                  : 'bg-gray-50 text-gray-500 hover:bg-green-50 hover:text-green-600 border border-gray-200'
                              }`}
                            >
                              <div className={`text-[10px] ${isSelected ? 'text-green-100' : 'text-gray-400'}`}>{formatSlotTime(slot)}</div>
                              {isSelected ? 'OK' : '-'}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
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

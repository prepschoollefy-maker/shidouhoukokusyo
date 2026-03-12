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

interface ComiruLesson {
  lesson_date: string
  start_time: string
  teacher_name: string
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

export default function StudentIndividualForm() {
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [period, setPeriod] = useState<Period | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set())
  const [comiruLessons, setComiruLessons] = useState<ComiruLesson[]>([])

  const [studentName, setStudentName] = useState('')
  const [studentGrade, setStudentGrade] = useState('')
  const [isResubmission, setIsResubmission] = useState(false)
  const [subjects, setSubjects] = useState<Record<string, number>>({})
  const [ngSlots, setNgSlots] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetch(`/api/lecture-scheduling/student/${params.token}`)
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
        setComiruLessons(json.comiruLessons || [])
        setStudentName(json.student.name)
        setStudentGrade(json.student.grade)

        // 既存回答の復元
        if (json.existingRequest) {
          setIsResubmission(true)
          setSubjects(json.existingRequest.subjects || {})
          setNote(json.existingRequest.note || '')
        }
        if (json.existingNgSlots && json.existingNgSlots.length > 0) {
          const ngs = new Set<string>()
          json.existingNgSlots.forEach((s: { ng_date: string; time_slot_id: string | null }) => {
            if (s.time_slot_id === null) {
              ngs.add(`${s.ng_date}|all`)
              json.timeSlots.forEach((ts: TimeSlot) => ngs.add(`${s.ng_date}|${ts.id}`))
            } else {
              ngs.add(`${s.ng_date}|${s.time_slot_id}`)
            }
          })
          setNgSlots(ngs)
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

  // comiru授業があるスロットのSet
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
          timeSlots.forEach(s => {
            if (!comiruBusySet.has(`${dateStr}|${s.id}`)) {
              next.add(`${dateStr}|${s.id}`)
            }
          })
        }
      } else {
        const key = `${dateStr}|${slotId}`
        if (comiruBusySet.has(key)) return next // comiru授業ありは切替不可
        if (next.has(key)) {
          next.delete(key)
          next.delete(`${dateStr}|all`)
        } else {
          next.add(key)
          const allNonBusySelected = timeSlots.every(s =>
            comiruBusySet.has(`${dateStr}|${s.id}`) || next.has(`${dateStr}|${s.id}`)
          )
          if (allNonBusySelected) next.add(`${dateStr}|all`)
        }
      }
      return next
    })
  }, [timeSlots, comiruBusySet])

  const handleSubjectChange = (subject: string, value: string) => {
    const num = parseInt(value) || 0
    setSubjects(prev => {
      const next = { ...prev }
      if (num > 0) next[subject] = num
      else delete next[subject]
      return next
    })
  }

  const totalLessons = Object.values(subjects).reduce((a, b) => a + b, 0)

  const handleConfirmOpen = (e: React.FormEvent) => {
    e.preventDefault()
    if (totalLessons === 0) { setError('科目ごとの希望コマ数を1つ以上入力してください'); return }
    setError('')
    setShowConfirm(true)
  }

  const handleSubmit = async () => {
    setShowConfirm(false)
    setSubmitting(true)
    setError('')

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
      const res = await fetch(`/api/lecture-scheduling/student/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects, ng_slots: ngSlotsArray, note: note || null }),
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><LoadingSpinner /></div>

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
          <p className="text-gray-500">ご回答ありがとうございます。日程が決まりましたらご連絡いたします。</p>
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
        <form onSubmit={handleConfirmOpen} className="space-y-6">
          {/* 生徒情報（自動表示） */}
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-2">
            <h2 className="font-semibold text-gray-900">生徒情報</h2>
            <p className="text-sm"><span className="text-gray-500">氏名:</span> {studentName}（{studentGrade}）</p>
            {isResubmission && (
              <p className="text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">前回の回答が復元されています。修正して再送信できます。</p>
            )}
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
            {totalLessons > 0 && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium text-blue-700">合計: {totalLessons}コマ</p>
              </div>
            )}
          </div>

          {/* NG日時グリッド */}
          <div className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">NG日時（参加できない日時）</h2>
            <div className="bg-red-50 rounded-lg border border-red-200 p-3 text-sm text-red-800 space-y-1">
              <p className="font-medium">参加<span className="underline underline-offset-2">できない</span>日時をタップしてください。</p>
              <p className="text-xs text-red-600">タップすると赤くなります = その時間はNGという意味です。何も選ばなければ全日程OKとなります。</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500" /> NG（参加不可）</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-300" /> 通常授業あり（自動NG）</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-100 border" /> OK（参加可能）</span>
            </div>

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
                          const hasComiruLesson = comiruBusySet.has(`${dateStr}|${slot.id}`)
                          return (
                            <td key={slot.id} className="px-1 py-1 border text-center">
                              {hasComiruLesson ? (
                                <div className="w-full py-1.5 rounded text-xs font-medium bg-orange-100 text-orange-600">
                                  授業あり
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleNg(dateStr, slot.id)}
                                  className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${
                                    isNg
                                      ? 'bg-red-500 text-white shadow-sm'
                                      : 'bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-400 border border-gray-200'
                                  }`}
                                >
                                  {isNg ? 'NG' : 'OK'}
                                </button>
                              )}
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

            {/* カード表示（モバイル） */}
            <div className="md:hidden space-y-2 -mx-5 px-5">
              {dates.map(dateStr => {
                const isAllDay = ngSlots.has(`${dateStr}|all`)
                const isClosed = closedDates.has(dateStr)
                const dow = new Date(dateStr + 'T00:00:00').getDay()
                const isWeekend = dow === 0 || dow === 6
                return (
                  <div key={dateStr} className={`rounded-lg border p-3 ${isClosed ? 'bg-gray-100' : isWeekend ? 'bg-blue-50/30' : 'bg-white'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{formatDate(dateStr)}</span>
                        {isClosed && <span className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">休館</span>}
                      </div>
                      {!isClosed && (
                        <button
                          type="button"
                          onClick={() => toggleNg(dateStr, null)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            isAllDay
                              ? 'bg-red-700 text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {isAllDay ? '終日NG' : '終日'}
                        </button>
                      )}
                    </div>
                    {isClosed ? (
                      <p className="text-xs text-gray-400">休館日</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {timeSlots.map(slot => {
                          const isNg = ngSlots.has(`${dateStr}|${slot.id}`)
                          const hasComiruLesson = comiruBusySet.has(`${dateStr}|${slot.id}`)
                          return hasComiruLesson ? (
                            <div key={slot.id} className="py-2 rounded text-xs text-center font-medium bg-orange-100 text-orange-600">
                              <div className="text-[10px] text-orange-400">{formatSlotTime(slot)}</div>
                              授業あり
                            </div>
                          ) : (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => toggleNg(dateStr, slot.id)}
                              className={`py-2 rounded text-xs font-medium transition-colors ${
                                isNg
                                  ? 'bg-red-500 text-white shadow-sm'
                                  : 'bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-400 border border-gray-200'
                              }`}
                            >
                              <div className={`text-[10px] ${isNg ? 'text-red-100' : 'text-gray-400'}`}>{formatSlotTime(slot)}</div>
                              {isNg ? 'NG' : 'OK'}
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
            {submitting ? '送信中...' : isResubmission ? '回答を更新する' : '確認画面へ'}
          </button>
        </form>
      </main>

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">送信内容の確認</h2>
            <div className="text-sm space-y-3">
              <div>
                <p className="text-gray-500 text-xs">生徒</p>
                <p className="font-medium">{studentName}（{studentGrade}）</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">希望科目・コマ数</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(subjects).map(([subj, cnt]) => (
                    <span key={subj} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                      {subj}: {cnt}コマ
                    </span>
                  ))}
                </div>
                <p className="text-blue-700 font-medium text-xs mt-1">合計: {totalLessons}コマ</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">NG日時</p>
                <p className="font-medium">
                  {ngSlots.size === 0
                    ? 'なし（全日程OK）'
                    : `${Array.from(ngSlots).filter(k => !k.endsWith('|all')).length}コマをNGに設定`
                  }
                </p>
              </div>
              {note && (
                <div>
                  <p className="text-gray-500 text-xs">要望</p>
                  <p className="font-medium">{note}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? '送信中...' : '送信する'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-400">レフィー</p>
      </footer>
    </div>
  )
}

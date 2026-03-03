'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, format, isToday,
} from 'date-fns'
import { ja } from 'date-fns/locale'

interface TimeSlot {
  id: string
  slot_number: number
  label: string
  start_time: string
  sort_order: number
}

interface Lesson {
  id: string
  student_id: string
  teacher_id: string
  subject_id: string | null
  lesson_date: string
  time_slot_id: string
  lesson_type: string
  status: string
  notes: string
  student: { id: string; name: string }
  subject: { id: string; name: string } | null
  time_slot: TimeSlot
}

const LESSON_TYPE_LABELS: Record<string, string> = {
  regular: '通常',
  intensive: '講習',
  makeup: '振替',
}

const LESSON_TYPE_COLORS: Record<string, string> = {
  regular: 'bg-blue-50 border-blue-200 text-blue-900',
  intensive: 'bg-orange-50 border-orange-200 text-orange-900',
  makeup: 'bg-green-50 border-green-200 text-green-900',
}

export default function TeacherSchedulePage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  // 月〜土（日曜を除外）
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(
    (d) => d.getDay() !== 0
  )

  const fetchTimeSlots = useCallback(async () => {
    const res = await fetch('/api/master/time-slots')
    const json = await res.json()
    setTimeSlots(json.data || [])
  }, [])

  const fetchLessons = useCallback(async () => {
    const startDate = format(weekStart, 'yyyy-MM-dd')
    const endDate = format(weekEnd, 'yyyy-MM-dd')
    const res = await fetch(`/api/lessons?start_date=${startDate}&end_date=${endDate}`)
    const json = await res.json()
    setLessons(json.data || [])
    setLoading(false)
  }, [weekStart, weekEnd])

  useEffect(() => { fetchTimeSlots() }, [fetchTimeSlots])
  useEffect(() => { fetchLessons() }, [fetchLessons])

  // マトリクス: matrix[time_slot_id][dateStr] = Lesson[]
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, Lesson[]>> = {}
    for (const slot of timeSlots) {
      m[slot.id] = {}
      for (const day of weekDays) {
        m[slot.id][format(day, 'yyyy-MM-dd')] = []
      }
    }
    for (const l of lessons) {
      if (m[l.time_slot_id]?.[l.lesson_date]) {
        m[l.time_slot_id][l.lesson_date].push(l)
      }
    }
    return m
  }, [timeSlots, weekDays, lessons])

  const navigate = (offset: number) => {
    setLoading(true)
    setCurrentDate((prev) => addWeeks(prev, offset))
  }

  const goToThisWeek = () => {
    setLoading(true)
    setCurrentDate(new Date())
  }

  if (loading && timeSlots.length === 0) return <LoadingSpinner />

  const headerLabel = `${format(weekStart, 'M月d日', { locale: ja })}〜${format(weekEnd, 'M月d日', { locale: ja })}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold">スケジュール</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{headerLabel}</span>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToThisWeek}>今週</Button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        {loading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : (
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="border p-2 bg-muted text-sm w-16">コマ</th>
                {weekDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const dayLabel = format(day, 'E', { locale: ja })
                  const isSat = day.getDay() === 6
                  return (
                    <th
                      key={dateStr}
                      className={`border p-2 text-sm ${
                        isToday(day) ? 'bg-blue-100' : 'bg-muted'
                      } ${isSat ? 'text-blue-600' : ''}`}
                    >
                      <div>{dayLabel}{format(day, 'M/d')}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot) => (
                <tr key={slot.id}>
                  <td className="border p-2 text-center bg-muted/50">
                    <div className="font-medium text-xs">{slot.label}</div>
                    <div className="text-[10px] text-muted-foreground">{slot.start_time.slice(0, 5)}</div>
                  </td>
                  {weekDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const cellLessons = matrix[slot.id]?.[dateStr] || []
                    return (
                      <td
                        key={dateStr}
                        className={`border p-1 align-top min-w-[100px] ${
                          isToday(day) ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="space-y-1">
                          {cellLessons.map((l) => {
                            const colorClass = LESSON_TYPE_COLORS[l.lesson_type] || LESSON_TYPE_COLORS.regular
                            const isCancelled = l.status === 'cancelled' || l.status === 'rescheduled'
                            return (
                              <div
                                key={l.id}
                                className={`rounded p-1 text-xs border ${colorClass} ${isCancelled ? 'opacity-40 line-through' : ''}`}
                              >
                                <div className="font-medium truncate">{l.student.name}</div>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {l.subject && (
                                    <span className="text-muted-foreground">{l.subject.name}</span>
                                  )}
                                  {l.lesson_type !== 'regular' && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                                      {LESSON_TYPE_LABELS[l.lesson_type]}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

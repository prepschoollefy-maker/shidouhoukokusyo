'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, format, isToday,
} from 'date-fns'
import { ja } from 'date-fns/locale'

// ─── Types ───────────────────────────

interface TimeSlot {
  id: string
  slot_number: number
  label: string
  start_time: string
  end_time: string
  sort_order: number
}

interface Lesson {
  id: string
  lesson_date: string
  time_slot_id: string
  lesson_type: string
  status: string
  notes: string
  student: { id: string; name: string }
  teacher: { id: string; display_name: string }
  subject: { id: string; name: string } | null
  time_slot: TimeSlot
  booth: { id: string; booth_number: number; label: string } | null
}

const LESSON_TYPE_LABELS: Record<string, string> = {
  regular: '通常',
  intensive: '講習',
  makeup: '振替',
}

const LESSON_TYPE_COLORS: Record<string, string> = {
  regular: 'bg-blue-50 border-blue-200',
  intensive: 'bg-orange-50 border-orange-200',
  makeup: 'bg-green-50 border-green-200',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: '予定',
  completed: '完了',
  cancelled: 'キャンセル',
  rescheduled: '振替済',
}

// ─── Main Page ───────────────────────────

export default function TeacherSchedulePage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const fetchTimeSlots = useCallback(async () => {
    const res = await fetch('/api/master/time-slots')
    const json = await res.json()
    setTimeSlots(json.data || [])
  }, [])

  const fetchLessons = useCallback(async () => {
    if (!userId) return
    const we = endOfWeek(weekStart, { weekStartsOn: 1 })
    const startDate = format(weekStart, 'yyyy-MM-dd')
    const endDate = format(we, 'yyyy-MM-dd')
    const res = await fetch(`/api/lessons?start_date=${startDate}&end_date=${endDate}`)
    const json = await res.json()
    // 自分の授業だけフィルタ
    const myLessons = (json.data || []).filter((l: Lesson) => l.teacher.id === userId)
    setLessons(myLessons)
    setLoading(false)
  }, [weekStart, userId])

  useEffect(() => { fetchTimeSlots() }, [fetchTimeSlots])
  useEffect(() => { fetchLessons() }, [fetchLessons])

  const goToWeek = (offset: number) => {
    setLoading(true)
    setWeekStart((prev) => addWeeks(prev, offset))
  }

  const goToThisWeek = () => {
    setLoading(true)
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  // 今日の授業リスト（モバイル用）
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayLessons = lessons
    .filter((l) => l.lesson_date === todayStr && l.status !== 'cancelled' && l.status !== 'rescheduled')
    .sort((a, b) => (a.time_slot?.sort_order || 0) - (b.time_slot?.sort_order || 0))

  // 週間マトリクス
  const matrix: Record<string, Record<string, Lesson[]>> = {}
  for (const day of weekDays) {
    const dateStr = format(day, 'yyyy-MM-dd')
    matrix[dateStr] = {}
    for (const s of timeSlots) {
      matrix[dateStr][s.id] = []
    }
  }
  for (const l of lessons) {
    if (matrix[l.lesson_date]?.[l.time_slot_id]) {
      matrix[l.lesson_date][l.time_slot_id].push(l)
    }
  }

  if (loading && timeSlots.length === 0) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">マイ時間割</h2>

      {/* 今日の授業（モバイル向けリスト表示） */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">
            今日の授業（{format(new Date(), 'M月d日(E)', { locale: ja })}）
          </h3>
          {todayLessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">今日の授業はありません</p>
          ) : (
            <div className="space-y-2">
              {todayLessons.map((l) => (
                <div
                  key={l.id}
                  className={`rounded-lg p-3 border ${LESSON_TYPE_COLORS[l.lesson_type] || ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{l.student.name}</span>
                      {l.subject && (
                        <Badge variant="secondary" className="ml-2 text-xs">{l.subject.name}</Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {l.time_slot.label}（{l.time_slot.start_time.slice(0, 5)}）
                    </span>
                  </div>
                  {l.booth && (
                    <div className="text-xs text-muted-foreground mt-1">{l.booth.label}</div>
                  )}
                  {l.lesson_type !== 'regular' && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {LESSON_TYPE_LABELS[l.lesson_type]}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 週間スケジュール */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">週間スケジュール</h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToThisWeek}>
            今週
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {format(weekStart, 'M月d日', { locale: ja })} 〜 {format(weekEnd, 'M月d日', { locale: ja })}
      </p>

      <Card>
        <CardContent className="p-2 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <table className="w-full border-collapse min-w-[700px] text-xs">
              <thead>
                <tr>
                  <th className="border p-1.5 bg-muted w-16">コマ</th>
                  {weekDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const dayLabel = format(day, 'E', { locale: ja })
                    const isSat = day.getDay() === 6
                    const isSun = day.getDay() === 0
                    return (
                      <th
                        key={dateStr}
                        className={`border p-1.5 ${
                          isToday(day) ? 'bg-blue-100' : 'bg-muted'
                        } ${isSat ? 'text-blue-600' : ''} ${isSun ? 'text-red-600' : ''}`}
                      >
                        <div>{format(day, 'M/d')}</div>
                        <div>({dayLabel})</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot) => (
                  <tr key={slot.id}>
                    <td className="border p-1.5 text-center bg-muted/50">
                      <div className="font-medium">{slot.label}</div>
                      <div className="text-muted-foreground">{slot.start_time.slice(0, 5)}</div>
                    </td>
                    {weekDays.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const cellLessons = matrix[dateStr]?.[slot.id] || []
                      return (
                        <td
                          key={dateStr}
                          className={`border p-1 align-top min-w-[90px] ${
                            isToday(day) ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          {cellLessons.map((l) => {
                            const isCancelled = l.status === 'cancelled' || l.status === 'rescheduled'
                            return (
                              <div
                                key={l.id}
                                className={`rounded p-1 border mb-1 ${
                                  LESSON_TYPE_COLORS[l.lesson_type] || ''
                                } ${isCancelled ? 'opacity-40 line-through' : ''}`}
                              >
                                <div className="font-medium truncate">{l.student.name}</div>
                                {l.subject && (
                                  <div className="text-muted-foreground truncate">{l.subject.name}</div>
                                )}
                                {isCancelled && (
                                  <div className="text-[10px] text-red-500">{STATUS_LABELS[l.status]}</div>
                                )}
                              </div>
                            )
                          })}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

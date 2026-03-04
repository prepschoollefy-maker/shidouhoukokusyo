'use client'

import { useEffect, useState, useCallback } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ClosedDay {
  id: string
  closed_date: string
  reason: string
}

function getFiscalYear(date: Date): number {
  const month = date.getMonth()
  return month >= 3 ? date.getFullYear() : date.getFullYear() - 1
}

function MiniMonth({ year, month, closedDays }: { year: number; month: number; closedDays: ClosedDay[] }) {
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const dayHeaders = ['月', '火', '水', '木', '金', '土', '日']

  const closedDates = new Set(closedDays.map((d) => d.closed_date))
  const closedReasonMap = new Map(closedDays.map((d) => [d.closed_date, d.reason]))

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="space-y-1.5">
      <div className="text-center text-sm font-semibold">{monthNames[month]}</div>
      <div className="grid grid-cols-7 gap-px text-center">
        {dayHeaders.map((d) => (
          <div key={d} className="text-[11px] text-muted-foreground font-medium">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="h-7" />
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isClosed = closedDates.has(dateStr)
          const reason = closedReasonMap.get(dateStr)
          const dow = (startDow + day - 1) % 7

          let textColor = ''
          if (dow === 5) textColor = 'text-blue-600'
          if (dow === 6) textColor = 'text-red-600'

          return (
            <div
              key={dateStr}
              className={`h-7 flex items-center justify-center text-[11px] rounded-sm ${textColor} ${isClosed ? 'bg-red-200 font-bold' : ''}`}
              title={isClosed ? (reason || '休館日') : undefined}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ClosedDaysPage() {
  const [fiscalYear, setFiscalYear] = useState(() => getFiscalYear(new Date()))
  const [closedDays, setClosedDays] = useState<ClosedDay[]>([])
  const [loading, setLoading] = useState(true)

  const fetchClosedDays = useCallback(async (fy: number) => {
    setLoading(true)
    try {
      const startDate = `${fy}-04-01`
      const endDate = `${fy + 1}-03-31`
      const res = await fetch(`/api/closed-days?start_date=${startDate}&end_date=${endDate}`)
      if (res.ok) {
        const json = await res.json()
        setClosedDays(json.data || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClosedDays(fiscalYear)
  }, [fiscalYear, fetchClosedDays])

  const months: { year: number; month: number }[] = []
  for (let i = 0; i < 12; i++) {
    const m = (3 + i) % 12
    const y = m >= 3 ? fiscalYear : fiscalYear + 1
    months.push({ year: y, month: m })
  }

  const closedDaysByMonth = new Map<string, ClosedDay[]>()
  for (const cd of closedDays) {
    const key = cd.closed_date.substring(0, 7)
    if (!closedDaysByMonth.has(key)) closedDaysByMonth.set(key, [])
    closedDaysByMonth.get(key)!.push(cd)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          休館日カレンダー
        </h2>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon-sm" onClick={() => setFiscalYear((y) => y - 1)}>
          <ChevronLeft />
        </Button>
        <span className="text-lg font-semibold">{fiscalYear}年度</span>
        <Button variant="outline" size="icon-sm" onClick={() => setFiscalYear((y) => y + 1)}>
          <ChevronRight />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-muted-foreground text-sm">読み込み中...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {months.map(({ year, month }) => {
              const key = `${year}-${String(month + 1).padStart(2, '0')}`
              return (
                <MiniMonth
                  key={key}
                  year={year}
                  month={month}
                  closedDays={closedDaysByMonth.get(key) || []}
                />
              )
            })}
          </div>

          {closedDays.length > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <h3 className="text-sm font-semibold mb-2">休館日一覧（{closedDays.length}日）</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                {closedDays.map((cd) => (
                  <div key={cd.id} className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-red-400 rounded-full shrink-0" />
                    <span>{cd.closed_date}</span>
                    {cd.reason && <span className="text-muted-foreground">- {cd.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

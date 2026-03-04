'use client'

import { useEffect, useState, useCallback } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ClosedDay {
  id: string
  closed_date: string
  reason: string
}

function getFiscalYear(date: Date): number {
  const month = date.getMonth() // 0-indexed
  return month >= 3 ? date.getFullYear() : date.getFullYear() - 1
}

function MiniMonth({ year, month, closedDates }: { year: number; month: number; closedDates: Set<string> }) {
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const dayHeaders = ['月', '火', '水', '木', '金', '土', '日']

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // 月曜始まり: 0=月, 1=火, ... 6=日
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="space-y-1">
      <div className="text-center text-xs font-semibold">{monthNames[month]}</div>
      <div className="grid grid-cols-7 gap-px text-center">
        {dayHeaders.map((d) => (
          <div key={d} className="text-[10px] text-muted-foreground">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="h-5" />
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isClosed = closedDates.has(dateStr)
          const dow = (startDow + day - 1) % 7 // 0=月 ... 6=日

          let textColor = ''
          if (dow === 5) textColor = 'text-blue-600' // 土曜
          if (dow === 6) textColor = 'text-red-600'   // 日曜

          return (
            <div
              key={dateStr}
              className={`h-5 flex items-center justify-center text-[10px] rounded-sm ${textColor} ${isClosed ? 'bg-red-200 font-bold' : ''}`}
              title={isClosed ? `休館日: ${dateStr}` : undefined}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ClosedDaysCalendarDialog() {
  const [open, setOpen] = useState(false)
  const [fiscalYear, setFiscalYear] = useState(() => getFiscalYear(new Date()))
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const fetchClosedDays = useCallback(async (fy: number) => {
    setLoading(true)
    try {
      const startDate = `${fy}-04-01`
      const endDate = `${fy + 1}-03-31`
      const res = await fetch(`/api/closed-days?start_date=${startDate}&end_date=${endDate}`)
      if (res.ok) {
        const json = await res.json()
        const dates = new Set<string>((json.data as ClosedDay[]).map((d) => d.closed_date))
        setClosedDates(dates)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchClosedDays(fiscalYear)
    }
  }, [open, fiscalYear, fetchClosedDays])

  // 年度の12ヶ月（4月〜翌3月）
  const months: { year: number; month: number }[] = []
  for (let i = 0; i < 12; i++) {
    const m = (3 + i) % 12 // 3=4月, 4=5月, ... 11=12月, 0=1月, 1=2月, 2=3月
    const y = m >= 3 ? fiscalYear : fiscalYear + 1
    months.push({ year: y, month: m })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarDays className="size-4" />
          <span className="hidden sm:inline">休館日カレンダー</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon-sm" onClick={() => setFiscalYear((y) => y - 1)}>
              <ChevronLeft />
            </Button>
            <span>{fiscalYear}年度</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setFiscalYear((y) => y + 1)}>
              <ChevronRight />
            </Button>
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-muted-foreground text-sm">読み込み中...</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {months.map(({ year, month }) => (
              <MiniMonth key={`${year}-${month}`} year={year} month={month} closedDates={closedDates} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

interface StudentBillingViewProps {
  students: { id: string; name: string; student_number: string | null }[]
  formatYen: (n: number) => string
}

interface MonthEntry {
  year: number
  month: number
  items: {
    type: 'contract' | 'lecture' | 'material' | 'manual' | 'adjustment'
    id: string
    label: string
    amount: number
    detail?: string
    payment?: { status: string; paid_amount: number; payment_date: string | null } | null
  }[]
  total: number
  suspended: boolean
}

export function StudentBillingView({ students, formatYen }: StudentBillingViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = useMemo(() =>
    [...students].sort((a, b) => {
      const na = a.student_number || ''
      const nb = b.student_number || ''
      return na.localeCompare(nb, 'ja', { numeric: true })
    }),
    [students]
  )

  return (
    <div className="space-y-1">
      {sorted.map(s => (
        <StudentRow
          key={s.id}
          student={s}
          isExpanded={expandedId === s.id}
          onToggle={() => setExpandedId(prev => prev === s.id ? null : s.id)}
          formatYen={formatYen}
        />
      ))}
      {sorted.length === 0 && (
        <div className="text-center text-muted-foreground py-8">生徒データがありません</div>
      )}
    </div>
  )
}

function StudentRow({
  student,
  isExpanded,
  onToggle,
  formatYen,
}: {
  student: { id: string; name: string; student_number: string | null }
  isExpanded: boolean
  onToggle: () => void
  formatYen: (n: number) => string
}) {
  const [history, setHistory] = useState<MonthEntry[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isExpanded || history !== null) return
    setLoading(true)
    fetch(`/api/students/${student.id}/billing-history?_t=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.data) setHistory(json.data) })
      .finally(() => setLoading(false))
  }, [isExpanded, student.id, history])

  return (
    <Card className={isExpanded ? 'border-primary/30' : ''}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        {isExpanded ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
        <span className="text-sm text-muted-foreground font-mono w-16 flex-shrink-0">{student.student_number || '-'}</span>
        <span className="font-medium">{student.name}</span>
      </button>
      {isExpanded && (
        <CardContent className="pt-0 pb-3 px-4">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && history && history.length === 0 && (
            <div className="text-sm text-muted-foreground py-2">請求データがありません</div>
          )}
          {!loading && history && history.length > 0 && (
            <div className="space-y-0 border rounded-md overflow-hidden">
              {history.map(m => (
                <MonthBlock key={`${m.year}-${m.month}`} entry={m} formatYen={formatYen} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function MonthBlock({ entry, formatYen }: { entry: MonthEntry; formatYen: (n: number) => string }) {
  const allPaid = entry.items.every(i => i.type === 'adjustment' || i.payment?.status === '入金済み')
  const hasUnpaid = entry.items.some(i => i.type !== 'adjustment' && (!i.payment || i.payment.status === '未入金'))
  const hasDiscrepancy = entry.items.some(i => i.payment?.status === '過不足あり')

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{entry.year}年{entry.month}月</span>
          {entry.suspended && <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">休塾中</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm">{formatYen(entry.total)}</span>
          {hasDiscrepancy ? (
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">過不足</Badge>
          ) : hasUnpaid ? (
            <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">未入金</Badge>
          ) : allPaid && entry.items.length > 0 ? (
            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">入金済</Badge>
          ) : null}
        </div>
      </div>
      <div className="divide-y">
        {entry.items.map(item => (
          <div key={`${item.type}-${item.id}`} className="flex items-center justify-between px-3 py-1.5 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <TypeBadge type={item.type} />
              <span className="truncate">{item.label}</span>
              {item.detail && <span className="text-xs text-muted-foreground">({item.detail})</span>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`font-mono ${item.amount < 0 ? 'text-red-600' : ''}`}>
                {item.amount < 0 ? `-${formatYen(Math.abs(item.amount))}` : formatYen(item.amount)}
              </span>
              {item.type !== 'adjustment' && (
                item.payment?.status === '入金済み'
                  ? <span className="text-green-600 text-xs w-10 text-right">済</span>
                  : item.payment?.status === '過不足あり'
                    ? <span className="text-yellow-600 text-xs w-10 text-right">過不足</span>
                    : <span className="text-red-500 text-xs w-10 text-right">未</span>
              )}
              {item.type === 'adjustment' && <span className="w-10" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    contract: 'bg-blue-50 text-blue-700',
    lecture: 'bg-purple-50 text-purple-700',
    material: 'bg-orange-50 text-orange-700',
    manual: 'bg-gray-100 text-gray-700',
    adjustment: 'bg-red-50 text-red-700',
  }
  const labels: Record<string, string> = {
    contract: '通常',
    lecture: '講習',
    material: '教材',
    manual: '個別',
    adjustment: '調整',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${styles[type] || ''}`}>
      {labels[type] || type}
    </span>
  )
}

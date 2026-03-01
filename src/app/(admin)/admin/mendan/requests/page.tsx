'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Check, MessageSquare } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface MendanRequestRow {
  id: string
  student_id: string
  candidate1: string
  candidate2: string
  candidate3: string
  candidate1_end: string | null
  candidate2_end: string | null
  candidate3_end: string | null
  message: string | null
  submitted_at: string
  handled: boolean
  student: { name: string }
  token: { period_label: string }
}

function formatDateTime(iso: string) {
  try {
    return format(new Date(iso), 'M/d (E) HH:mm', { locale: ja })
  } catch {
    return iso
  }
}

function formatTimeRange(start: string, end: string | null) {
  try {
    const startStr = format(new Date(start), 'M/d (E) HH:mm', { locale: ja })
    if (end) {
      const endStr = format(new Date(end), 'HH:mm', { locale: ja })
      return `${startStr}〜${endStr}`
    }
    return startStr
  } catch {
    return start
  }
}

export default function MendanRequestsPage() {
  const [requests, setRequests] = useState<MendanRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [handledFilter, setHandledFilter] = useState<'all' | 'unhandled' | 'handled'>('unhandled')
  const [selectedRequest, setSelectedRequest] = useState<MendanRequestRow | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/mendan/requests')
      const json = await res.json()
      setRequests(json.data || [])
    } catch {
      toast.error('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleHandled = async (id: string, currentHandled: boolean) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, handled: !currentHandled } : r))
    try {
      const res = await fetch('/api/mendan/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, handled: !currentHandled }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, handled: currentHandled } : r))
      toast.error('更新に失敗しました')
    }
  }

  if (loading) return <LoadingSpinner />

  const filtered = requests.filter(r => {
    if (searchQuery && !r.student.name.includes(searchQuery) && !(r.token as unknown as { period_label: string }).period_label.includes(searchQuery)) return false
    if (handledFilter === 'unhandled' && r.handled) return false
    if (handledFilter === 'handled' && !r.handled) return false
    return true
  })

  const unhandledCount = requests.filter(r => !r.handled).length

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">面談希望申請</h2>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="生徒名・期間で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={handledFilter} onValueChange={(v) => setHandledFilter(v as 'all' | 'unhandled' | 'handled')}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="unhandled">未対応</SelectItem>
            <SelectItem value="handled">対応済</SelectItem>
            <SelectItem value="all">すべて</SelectItem>
          </SelectContent>
        </Select>
        {unhandledCount > 0 && <Badge variant="destructive">{unhandledCount}件 未対応</Badge>}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">対応</TableHead>
                <TableHead>生徒名</TableHead>
                <TableHead>期間</TableHead>
                <TableHead>第1希望</TableHead>
                <TableHead>第2希望</TableHead>
                <TableHead>第3希望</TableHead>
                <TableHead>メッセージ</TableHead>
                <TableHead>申請日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {handledFilter === 'unhandled' ? '未対応の申請はありません' : '面談申請はありません'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(r => (
                  <TableRow key={r.id} className={`${r.handled ? 'opacity-60' : ''} cursor-pointer hover:bg-muted/50`} onClick={() => setSelectedRequest(r)}>
                    <TableCell className="text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleHandled(r.id, r.handled) }}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors ${
                          r.handled ? 'bg-green-100 border-green-400 text-green-700' : 'bg-white border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-600'
                        }`}
                        title={r.handled ? '対応済 → 未対応に戻す' : '対応済にする'}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{r.student.name}</TableCell>
                    <TableCell>{(r.token as unknown as { period_label: string }).period_label}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatTimeRange(r.candidate1, r.candidate1_end)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatTimeRange(r.candidate2, r.candidate2_end)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatTimeRange(r.candidate3, r.candidate3_end)}</TableCell>
                    <TableCell className="max-w-[200px]">
                      {r.message ? (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{r.message}</span>
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.submitted_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) setSelectedRequest(null) }}>
        <DialogContent className="max-w-lg">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{selectedRequest.student.name} の面談希望</span>
                  <Badge variant={selectedRequest.handled ? 'secondary' : 'destructive'} className="ml-2">
                    {selectedRequest.handled ? '対応済' : '未対応'}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  <span className="font-medium text-muted-foreground">期間</span>
                  <span>{(selectedRequest.token as unknown as { period_label: string }).period_label}</span>
                  <span className="font-medium text-muted-foreground">第1希望</span>
                  <span>{formatTimeRange(selectedRequest.candidate1, selectedRequest.candidate1_end)}</span>
                  <span className="font-medium text-muted-foreground">第2希望</span>
                  <span>{formatTimeRange(selectedRequest.candidate2, selectedRequest.candidate2_end)}</span>
                  <span className="font-medium text-muted-foreground">第3希望</span>
                  <span>{formatTimeRange(selectedRequest.candidate3, selectedRequest.candidate3_end)}</span>
                  <span className="font-medium text-muted-foreground">申請日</span>
                  <span>{formatDateTime(selectedRequest.submitted_at)}</span>
                </div>
                {selectedRequest.message && (
                  <div className="space-y-1">
                    <span className="font-medium text-muted-foreground">メッセージ</span>
                    <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{selectedRequest.message}</p>
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      toggleHandled(selectedRequest.id, selectedRequest.handled)
                      setSelectedRequest(prev => prev ? { ...prev, handled: !prev.handled } : null)
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedRequest.handled
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                    {selectedRequest.handled ? '未対応に戻す' : '対応済にする'}
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

// ─── Types ───────────────────────────

interface TimeSlot {
  id: string
  slot_number: number
  label: string
  start_time: string
}

interface Booth {
  id: string
  booth_number: number
  label: string
}

interface RescheduleRequest {
  id: string
  lesson_id: string
  requested_by: string
  reason: string
  status: string
  new_lesson_id: string | null
  requested_at: string
  responded_at: string | null
  lesson: {
    id: string
    lesson_date: string
    lesson_type: string
    status: string
    student: { id: string; name: string }
    teacher: { id: string; display_name: string }
    subject: { id: string; name: string } | null
    time_slot: TimeSlot
    booth: Booth | null
  }
  new_lesson: {
    id: string
    lesson_date: string
    time_slot: { id: string; label: string; start_time: string }
  } | null
}

interface ApproveForm {
  lesson_date: string
  time_slot_id: string
  booth_id: string
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '未対応', variant: 'default' },
  approved: { label: '承認済', variant: 'secondary' },
  rejected: { label: '却下', variant: 'destructive' },
}

// ─── Main Page ───────────────────────────

export default function ReschedulePage() {
  const [requests, setRequests] = useState<RescheduleRequest[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [booths, setBooths] = useState<Booth[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('pending')

  const [approveTarget, setApproveTarget] = useState<RescheduleRequest | null>(null)
  const [approveForm, setApproveForm] = useState<ApproveForm>({ lesson_date: '', time_slot_id: '', booth_id: '' })
  const [processing, setProcessing] = useState(false)

  const fetchRequests = useCallback(async () => {
    const params = filter ? `?status=${filter}` : ''
    const res = await fetch(`/api/reschedule-requests${params}`)
    const json = await res.json()
    setRequests(json.data || [])
    setLoading(false)
  }, [filter])

  const fetchMasters = useCallback(async () => {
    const [slotsRes, boothsRes] = await Promise.all([
      fetch('/api/master/time-slots'),
      fetch('/api/master/booths'),
    ])
    const [slotsJson, boothsJson] = await Promise.all([slotsRes.json(), boothsRes.json()])
    setTimeSlots(slotsJson.data || [])
    setBooths((boothsJson.data || []).filter((b: Booth & { is_active?: boolean }) => b.is_active !== false))
  }, [])

  useEffect(() => { fetchMasters() }, [fetchMasters])
  useEffect(() => { fetchRequests() }, [fetchRequests])

  const openApprove = (req: RescheduleRequest) => {
    setApproveTarget(req)
    setApproveForm({
      lesson_date: '',
      time_slot_id: req.lesson.time_slot.id,
      booth_id: req.lesson.booth?.id || '',
    })
  }

  const handleApprove = async () => {
    if (!approveTarget || !approveForm.lesson_date || !approveForm.time_slot_id) {
      toast.error('振替先の日付とコマを指定してください')
      return
    }
    setProcessing(true)
    try {
      const res = await fetch(`/api/reschedule-requests/${approveTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          new_lesson: {
            student_id: approveTarget.lesson.student.id,
            teacher_id: approveTarget.lesson.teacher.id,
            subject_id: approveTarget.lesson.subject?.id || null,
            lesson_date: approveForm.lesson_date,
            time_slot_id: approveForm.time_slot_id,
            booth_id: approveForm.booth_id || null,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || '承認に失敗しました')
        return
      }
      toast.success('振替を承認しました')
      setApproveTarget(null)
      fetchRequests()
    } catch {
      toast.error('承認に失敗しました')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (req: RescheduleRequest) => {
    setProcessing(true)
    try {
      const res = await fetch(`/api/reschedule-requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || '却下に失敗しました')
        return
      }
      toast.success('振替を却下しました（元の授業を復元）')
      fetchRequests()
    } catch {
      toast.error('却下に失敗しました')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">振替管理</h2>
        <Select value={filter} onValueChange={(v) => { setFilter(v); setLoading(true) }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">未対応</SelectItem>
            <SelectItem value="approved">承認済</SelectItem>
            <SelectItem value="rejected">却下</SelectItem>
            <SelectItem value="all">すべて</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-4">
          {requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {filter === 'pending' ? '未対応の振替申請はありません' : '該当する振替申請はありません'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申請日</TableHead>
                  <TableHead>生徒</TableHead>
                  <TableHead>元の授業</TableHead>
                  <TableHead>理由</TableHead>
                  <TableHead>振替先</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => {
                  const s = STATUS_LABELS[req.status] || STATUS_LABELS.pending
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(req.requested_at), 'M/d', { locale: ja })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {req.lesson.student.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{req.lesson.lesson_date}</div>
                        <div className="text-muted-foreground">
                          {req.lesson.time_slot.label}（{req.lesson.time_slot.start_time.slice(0, 5)}）
                        </div>
                        <div className="text-muted-foreground">{req.lesson.teacher.display_name}</div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {req.reason || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {req.new_lesson ? (
                          <div>
                            <div>{req.new_lesson.lesson_date}</div>
                            <div className="text-muted-foreground">
                              {req.new_lesson.time_slot.label}（{req.new_lesson.time_slot.start_time.slice(0, 5)}）
                            </div>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {req.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openApprove(req)}
                              disabled={processing}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleReject(req)}
                              disabled={processing}
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 承認ダイアログ（振替先指定） */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => { if (!open) setApproveTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>振替先を指定</DialogTitle>
            <DialogDescription>
              {approveTarget?.lesson.student.name}の振替先を指定してください
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>振替先日付 *</Label>
              <Input
                type="date"
                value={approveForm.lesson_date}
                onChange={(e) => setApproveForm({ ...approveForm, lesson_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>コマ *</Label>
              <Select value={approveForm.time_slot_id} onValueChange={(v) => setApproveForm({ ...approveForm, time_slot_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {timeSlots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}（{s.start_time.slice(0, 5)}）</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>ブース</Label>
              <Select value={approveForm.booth_id} onValueChange={(v) => setApproveForm({ ...approveForm, booth_id: v })}>
                <SelectTrigger><SelectValue placeholder="ブースを選択" /></SelectTrigger>
                <SelectContent>
                  {booths.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>キャンセル</Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? '処理中...' : '承認する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

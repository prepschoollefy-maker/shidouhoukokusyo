'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Plus, Copy, Trash2, ExternalLink, ChevronDown, ChevronRight, Check, Pencil, RefreshCw, Users, Link } from 'lucide-react'

interface ComiruLesson {
  teacher_name: string
  lesson_date: string
  start_time: string
  end_time: string
  synced_at: string
  student_name: string | null
}

interface Period {
  id: string
  label: string
  start_date: string
  end_date: string
  student_token: string
  student_deadline: string | null
  status: 'open' | 'closed' | 'confirmed'
  created_at: string
}

interface Student {
  id: string
  name: string
  student_number: string
  grade: string
}

interface TimeSlot {
  id: string
  slot_number: number
  label: string
  start_time: string
  end_time: string
}

interface Teacher {
  id: string
  display_name: string
}

interface Request {
  id: string
  period_id: string
  student_id: string
  subjects: Record<string, number>
  note: string | null
  submitted_at: string
  student: Student
}

interface Assignment {
  id: string
  request_id: string
  teacher_id: string
  token: string
  expires_at: string
  status: 'pending' | 'responded' | 'confirmed'
  teacher: Teacher
}

interface NgSlot {
  request_id: string
  ng_date: string
  time_slot_id: string | null
}

interface Response {
  assignment_id: string
  available_date: string
  time_slot_id: string
}

interface Confirmation {
  id: string
  request_id: string
  assignment_id: string
  confirmed_date: string
  time_slot_id: string
  subject: string
  confirmed_at: string
}

interface StudentToken {
  id: string
  period_id: string
  student_id: string
  token: string
  created_at: string
  student: Student
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`
}

function formatSlotTime(slot: TimeSlot): string {
  return `${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`
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

const statusLabels: Record<string, { label: string; color: string }> = {
  open: { label: '受付中', color: 'bg-green-100 text-green-800' },
  closed: { label: '受付終了', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: '確定', color: 'bg-blue-100 text-blue-800' },
}

const assignmentStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '未回答', color: 'bg-gray-100 text-gray-600' },
  responded: { label: '回答済', color: 'bg-green-100 text-green-800' },
  confirmed: { label: '確定', color: 'bg-blue-100 text-blue-800' },
}

export default function LectureSchedulingAdmin() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<Period | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Period | null>(null)

  // 期間詳細データ
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [requests, setRequests] = useState<Request[]>([])
  const [ngSlots, setNgSlots] = useState<NgSlot[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [responses, setResponses] = useState<Response[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set())
  const [comiruLessons, setComiruLessons] = useState<ComiruLesson[]>([])
  const [confirmations, setConfirmations] = useState<Confirmation[]>([])

  // 生徒個別URL
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [studentTokens, setStudentTokens] = useState<StudentToken[]>([])
  const [showStudentTokenDialog, setShowStudentTokenDialog] = useState(false)
  const [generatingTokens, setGeneratingTokens] = useState(false)
  const [tokenSearchQuery, setTokenSearchQuery] = useState('')

  // UI状態
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set())
  const [comiruSyncing, setComiruSyncing] = useState(false)
  const [assignTeacherId, setAssignTeacherId] = useState('')
  const [assigningRequestId, setAssigningRequestId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Assignment | null>(null)
  const [viewMode, setViewMode] = useState<'student' | 'teacher'>('student')
  const [confirmMode, setConfirmMode] = useState(false)
  const [confirmPopover, setConfirmPopover] = useState<{
    requestId: string
    date: string
    slotId: string
    okTeachers: Assignment[]
    subjects: Record<string, number>
  } | null>(null)
  const [confirmTeacherId, setConfirmTeacherId] = useState('')
  const [confirmSubject, setConfirmSubject] = useState('')

  const fetchPeriods = useCallback(async () => {
    const res = await fetch('/api/lecture-scheduling/periods')
    if (res.ok) setPeriods(await res.json())
    setLoading(false)
  }, [])

  const fetchAllStudents = useCallback(async () => {
    const res = await fetch('/api/students?status=active')
    if (res.ok) {
      const json = await res.json()
      setAllStudents(json.data || [])
    }
  }, [])

  useEffect(() => { fetchPeriods(); fetchAllStudents() }, [fetchPeriods, fetchAllStudents])

  const fetchOverview = useCallback(async (periodId: string) => {
    setOverviewLoading(true)
    const res = await fetch(`/api/lecture-scheduling/admin/overview?period_id=${periodId}`)
    if (res.ok) {
      const data = await res.json()
      setRequests(data.requests)
      setNgSlots(data.ngSlots)
      setAssignments(data.assignments)
      setResponses(data.responses)
      setTimeSlots(data.timeSlots)
      setTeachers(data.teachers)
      setClosedDates(new Set(data.closedDates || []))
      setComiruLessons(data.comiruLessons || [])
      setConfirmations(data.confirmations || [])
    }
    setOverviewLoading(false)
  }, [])

  const fetchStudentTokens = useCallback(async (periodId: string) => {
    const res = await fetch(`/api/lecture-scheduling/admin/student-tokens?period_id=${periodId}`)
    if (res.ok) setStudentTokens(await res.json())
  }, [])

  const handleGenerateStudentTokens = async (studentIds: string[]) => {
    if (!selectedPeriod || studentIds.length === 0) return
    setGeneratingTokens(true)
    const res = await fetch('/api/lecture-scheduling/admin/student-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_id: selectedPeriod.id, student_ids: studentIds }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.created > 0) {
        toast.success(`${data.created}名分のURLを発行しました`)
      } else {
        toast.info(data.message || '全員のURLは発行済みです')
      }
      fetchStudentTokens(selectedPeriod.id)
    } else {
      toast.error('URL発行に失敗しました')
    }
    setGeneratingTokens(false)
  }

  useEffect(() => {
    if (selectedPeriod) {
      fetchOverview(selectedPeriod.id)
      fetchStudentTokens(selectedPeriod.id)
    }
  }, [selectedPeriod, fetchOverview, fetchStudentTokens])

  const handleCreatePeriod = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/lecture-scheduling/periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: form.get('label'),
        start_date: form.get('start_date'),
        end_date: form.get('end_date'),
        student_deadline: form.get('student_deadline') || null,
      }),
    })
    if (res.ok) {
      toast.success('講習期間を作成しました')
      setShowCreateDialog(false)
      fetchPeriods()
    } else {
      const err = await res.json()
      toast.error(err.error || 'エラー')
    }
  }

  const handleDeletePeriod = async () => {
    if (!deleteTarget) return
    const res = await fetch(`/api/lecture-scheduling/periods/${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('削除しました')
      if (selectedPeriod?.id === deleteTarget.id) setSelectedPeriod(null)
      fetchPeriods()
    } else {
      toast.error('削除に失敗しました')
    }
    setDeleteTarget(null)
  }

  const handleEditPeriod = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    const res = await fetch(`/api/lecture-scheduling/periods/${editTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: form.get('label'),
        start_date: form.get('start_date'),
        end_date: form.get('end_date'),
        student_deadline: form.get('student_deadline') || null,
      }),
    })
    if (res.ok) {
      toast.success('更新しました')
      setEditTarget(null)
      fetchPeriods()
    } else {
      const err = await res.json()
      toast.error(err.error || 'エラー')
    }
  }

  const handleStatusChange = async (period: Period, newStatus: string) => {
    const res = await fetch(`/api/lecture-scheduling/periods/${period.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      toast.success('ステータスを更新しました')
      fetchPeriods()
      if (selectedPeriod?.id === period.id) {
        setSelectedPeriod({ ...period, status: newStatus as Period['status'] })
      }
    }
  }

  const handleAssignTeacher = async (requestId: string) => {
    if (!assignTeacherId) return
    const res = await fetch('/api/lecture-scheduling/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, teacher_id: assignTeacherId }),
    })
    if (res.ok) {
      toast.success('講師をアサインしました')
      setAssignTeacherId('')
      setAssigningRequestId(null)
      if (selectedPeriod) fetchOverview(selectedPeriod.id)
    } else {
      const err = await res.json()
      toast.error(err.error || 'エラー')
    }
  }

  const handleRemoveAssignment = async () => {
    if (!removeTarget) return
    const res = await fetch(`/api/lecture-scheduling/admin/assignments/${removeTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('アサインを解除しました')
      if (selectedPeriod) fetchOverview(selectedPeriod.id)
    }
    setRemoveTarget(null)
  }

  const handleComiruSync = async () => {
    if (!selectedPeriod) return
    setComiruSyncing(true)
    try {
      // Step 1: Edge Function でcomiruにログイン（POSTはVercelからブロックされるため）
      const loginRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/comiru-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({}),
        }
      )
      const loginData = await loginRes.json()
      if (!loginRes.ok || !loginData.success) {
        throw new Error(loginData.error || 'comiruログイン失敗')
      }

      // Step 2: Next.js API でCSV取得・デコード・保存（GETはVercelからOK、Node.jsでShift-JIS対応）
      const syncRes = await fetch('/api/lecture-scheduling/admin/comiru-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_id: selectedPeriod.id, cookies: loginData.cookies }),
      })
      const syncData = await syncRes.json()
      if (syncRes.ok && syncData.success) {
        toast.success(`comiru同期完了（${syncData.count}件）`)
      } else {
        throw new Error(syncData.error || 'comiru同期失敗')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'comiru同期に失敗しました')
    }
    await fetchOverview(selectedPeriod.id)
    setComiruSyncing(false)
  }

  // comiru授業データで講師が特定の日時に持っている授業の生徒名一覧を返す
  const getComiruStudents = (teacherName: string, dateStr: string, slot: TimeSlot): string[] => {
    const slotStart = slot.start_time.slice(0, 5) // "12:30"
    return comiruLessons
      .filter(l =>
        l.teacher_name === teacherName &&
        l.lesson_date === dateStr &&
        l.start_time.slice(0, 5) === slotStart
      )
      .map(l => l.student_name || '(不明)')
  }

  const isComiruBusy = (teacherName: string, dateStr: string, slot: TimeSlot): boolean => {
    return getComiruStudents(teacherName, dateStr, slot).length > 0
  }

  // 講師OKトグル: assignment_idを指定して日時のOKを追加/削除
  const handleToggleTeacherOk = async (assignmentId: string, date: string, slotId: string) => {
    const res = await fetch('/api/lecture-scheduling/admin/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'teacher_ok', assignment_id: assignmentId, available_date: date, time_slot_id: slotId }),
    })
    if (res.ok) {
      const data = await res.json()
      toast.success(data.action === 'added' ? 'OKを追加しました' : 'OKを取り消しました')
      if (selectedPeriod) fetchOverview(selectedPeriod.id)
    }
  }

  // 生徒NGトグル: request_idを指定して日時のNGを追加/削除
  const handleToggleStudentNg = async (requestId: string, date: string, slotId: string) => {
    const res = await fetch('/api/lecture-scheduling/admin/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'student_ng', request_id: requestId, ng_date: date, time_slot_id: slotId }),
    })
    if (res.ok) {
      const data = await res.json()
      toast.success(data.action === 'added' ? 'NGを追加しました' : 'NGを取り消しました')
      if (selectedPeriod) fetchOverview(selectedPeriod.id)
    }
  }

  const handleConfirm = async () => {
    if (!confirmPopover || !confirmTeacherId || !confirmSubject) return
    const res = await fetch('/api/lecture-scheduling/admin/confirmations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: confirmPopover.requestId,
        assignment_id: confirmTeacherId,
        confirmed_date: confirmPopover.date,
        time_slot_id: confirmPopover.slotId,
        subject: confirmSubject,
      }),
    })
    if (res.ok) {
      toast.success('確定しました')
      setConfirmPopover(null)
      setConfirmTeacherId('')
      setConfirmSubject('')
      if (selectedPeriod) fetchOverview(selectedPeriod.id)
    } else {
      const err = await res.json()
      toast.error(err.error || 'エラー')
    }
  }

  const handleDeleteConfirmation = async () => {
    if (!confirmPopover) return
    const res = await fetch('/api/lecture-scheduling/admin/confirmations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: confirmPopover.requestId,
        confirmed_date: confirmPopover.date,
        time_slot_id: confirmPopover.slotId,
      }),
    })
    if (res.ok) {
      toast.success('確定を解除しました')
      setConfirmPopover(null)
      setConfirmTeacherId('')
      setConfirmSubject('')
      if (selectedPeriod) fetchOverview(selectedPeriod.id)
    }
  }

  const copyTeacherUrl = (token: string) => {
    const url = `${window.location.origin}/lecture-scheduling/teacher/${token}`
    navigator.clipboard.writeText(url)
    toast.success('URLをコピーしました')
  }

  const copyStudentUrl = (token: string) => {
    const url = `${window.location.origin}/lecture-scheduling/${token}`
    navigator.clipboard.writeText(url)
    toast.success('生徒用URLをコピーしました')
  }

  const copyStudentIndividualUrl = (token: string) => {
    const url = `${window.location.origin}/lecture-scheduling/student/${token}`
    navigator.clipboard.writeText(url)
    toast.success('個別URLをコピーしました')
  }

  const toggleExpand = (requestId: string) => {
    setExpandedRequests(prev => {
      const next = new Set(prev)
      if (next.has(requestId)) next.delete(requestId)
      else next.add(requestId)
      return next
    })
  }

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>

  // 期間未選択: 一覧表示
  if (!selectedPeriod) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">講習日程調整</h2>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />新規作成
          </Button>
        </div>

        {periods.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-gray-500">講習期間がありません</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {periods.map(p => {
              const st = statusLabels[p.status]
              return (
                <Card key={p.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedPeriod(p)}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{p.label}</span>
                        <Badge className={st.color}>{st.label}</Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {p.start_date} 〜 {p.end_date}
                        {p.student_deadline && ` / 回答期限: ${new Date(p.student_deadline).toLocaleDateString('ja-JP')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditTarget(p) }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p) }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* 新規作成ダイアログ */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>講習期間の作成</DialogTitle></DialogHeader>
            <form onSubmit={handleCreatePeriod} className="space-y-4">
              <div>
                <label className="text-sm font-medium">ラベル <span className="text-red-500">*</span></label>
                <input name="label" required placeholder="例: 2026春期講習" className="w-full mt-1 rounded-md border px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">開始日 <span className="text-red-500">*</span></label>
                  <input name="start_date" type="date" required className="w-full mt-1 rounded-md border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">終了日 <span className="text-red-500">*</span></label>
                  <input name="end_date" type="date" required className="w-full mt-1 rounded-md border px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">生徒回答期限</label>
                <input name="student_deadline" type="datetime-local" className="w-full mt-1 rounded-md border px-3 py-2 text-sm" />
              </div>
              <Button type="submit" className="w-full">作成</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* 編集ダイアログ */}
        <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>講習期間の編集</DialogTitle></DialogHeader>
            {editTarget && (
              <form onSubmit={handleEditPeriod} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">ラベル <span className="text-red-500">*</span></label>
                  <input name="label" required defaultValue={editTarget.label} className="w-full mt-1 rounded-md border px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">開始日 <span className="text-red-500">*</span></label>
                    <input name="start_date" type="date" required defaultValue={editTarget.start_date} className="w-full mt-1 rounded-md border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">終了日 <span className="text-red-500">*</span></label>
                    <input name="end_date" type="date" required defaultValue={editTarget.end_date} className="w-full mt-1 rounded-md border px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">生徒回答期限</label>
                  <input name="student_deadline" type="datetime-local" defaultValue={editTarget.student_deadline?.slice(0, 16) || ''} className="w-full mt-1 rounded-md border px-3 py-2 text-sm" />
                </div>
                <Button type="submit" className="w-full">更新</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={() => setDeleteTarget(null)}
          title="講習期間の削除"
          description={`「${deleteTarget?.label}」を削除しますか？関連する全データも削除されます。`}
          onConfirm={handleDeletePeriod}
          variant="destructive"
        />
      </div>
    )
  }

  // 期間詳細: 生徒回答一覧 + 講師アサイン + 回答一覧
  const dates = generateDateRange(selectedPeriod.start_date, selectedPeriod.end_date)
  const st = statusLabels[selectedPeriod.status]

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" onClick={() => setSelectedPeriod(null)} className="text-sm">
          ← 一覧に戻る
        </Button>
        <h2 className="text-2xl font-bold">{selectedPeriod.label}</h2>
        <Badge className={st.color}>{st.label}</Badge>
      </div>

      {/* 操作バー */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button size="sm" variant="outline" onClick={() => setShowStudentTokenDialog(true)}>
          <Link className="h-3 w-3 mr-1" />生徒個別URL
          {studentTokens.length > 0 && <Badge className="ml-1 bg-blue-100 text-blue-800 text-[10px] px-1">{studentTokens.length}</Badge>}
        </Button>
        {selectedPeriod.status === 'open' && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedPeriod, 'closed')}>
            受付終了にする
          </Button>
        )}
        {selectedPeriod.status === 'closed' && (
          <>
            <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedPeriod, 'open')}>
              受付を再開する
            </Button>
            <Button size="sm" onClick={() => handleStatusChange(selectedPeriod, 'confirmed')}>
              <Check className="h-3 w-3 mr-1" />確定する
            </Button>
          </>
        )}
        {selectedPeriod.status === 'confirmed' && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedPeriod, 'closed')}>
            確定を解除
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleComiruSync} disabled={comiruSyncing} className="ml-auto">
          <RefreshCw className={`h-3 w-3 mr-1 ${comiruSyncing ? 'animate-spin' : ''}`} />
          {comiruSyncing ? 'comiru同期中...' : 'comiru反映'}
        </Button>
        {comiruLessons.length > 0 ? (
          <span className="text-xs text-gray-400">
            comiru {comiruLessons.length}件 / 最終同期: {new Date(comiruLessons[0]?.synced_at).toLocaleString('ja-JP')}
          </span>
        ) : (
          <span className="text-xs text-orange-500">
            comiru未同期（「comiru反映」ボタンで同期）
          </span>
        )}
      </div>

      {overviewLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-4">
          {/* 回答状況サマリ + ビュー切替 */}
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex gap-6 text-sm">
                  <span>生徒回答: <strong>{requests.length}件</strong></span>
                  <span>講師アサイン: <strong>{assignments.length}件</strong></span>
                  <span>講師回答済: <strong>{assignments.filter(a => a.status === 'responded').length}件</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  {viewMode === 'student' && (
                    <Button
                      size="sm"
                      variant={confirmMode ? 'default' : 'outline'}
                      onClick={() => setConfirmMode(!confirmMode)}
                      className={confirmMode ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    >
                      {confirmMode ? '確定モード ON' : '確定モード'}
                    </Button>
                  )}
                  <div className="flex rounded-lg border overflow-hidden">
                    <button
                      onClick={() => setViewMode('student')}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'student' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      生徒別
                    </button>
                    <button
                      onClick={() => setViewMode('teacher')}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'teacher' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      講師別
                    </button>
                  </div>
                </div>
              </div>
              {/* 凡例 + 操作ヒント */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 border-t pt-2">
                <span className="font-medium text-gray-700">凡例:</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" /> NG（生徒不可）</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-300" /> 講師OK（担当可能）</span>
                {viewMode === 'teacher' && (
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-300" /> 授業あり（comiru）</span>
                )}
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-200 border border-blue-400" /> 確定済</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-300" /> 未回答</span>
                <span className="text-gray-400 ml-2">|</span>
                {viewMode === 'student' ? (
                  confirmMode ? (
                    <span className="text-blue-600 font-medium">セルをクリック → 講師・科目を確定</span>
                  ) : (
                    <span className="text-blue-600 font-medium">セルをクリック → 生徒のNG/OK切替</span>
                  )
                ) : (
                  <span className="text-blue-600 font-medium">セルをクリック → 講師のOK/未回答切替</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 講師別ビュー */}
          {viewMode === 'teacher' && (
            <div className="space-y-4">
              {teachers.filter(t => assignments.some(a => a.teacher_id === t.id)).length === 0 ? (
                <Card><CardContent className="py-12 text-center text-gray-500">まだ講師がアサインされていません</CardContent></Card>
              ) : (
                teachers
                  .filter(t => assignments.some(a => a.teacher_id === t.id))
                  .map(teacher => {
                    const teacherAssignments = assignments.filter(a => a.teacher_id === teacher.id)
                    const teacherResponses = responses.filter(r => teacherAssignments.some(a => a.id === r.assignment_id))
                    const respondedCount = teacherAssignments.filter(a => a.status === 'responded').length
                    const isExpanded = expandedRequests.has(`teacher-${teacher.id}`)

                    return (
                      <Card key={teacher.id}>
                        <CardHeader className="cursor-pointer py-3" onClick={() => toggleExpand(`teacher-${teacher.id}`)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <CardTitle className="text-base">{teacher.display_name}</CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                担当: {teacherAssignments.length}名
                              </Badge>
                              <Badge className={respondedCount === teacherAssignments.length && teacherAssignments.length > 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                回答: {respondedCount}/{teacherAssignments.length}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                OK: {teacherResponses.length}コマ
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>

                        {isExpanded && (
                          <CardContent className="pt-0 space-y-4">
                            {/* 担当生徒一覧 */}
                            <div className="space-y-2">
                              {teacherAssignments.map(a => {
                                const req = requests.find(r => r.id === a.request_id)
                                const ast = assignmentStatusLabels[a.status]
                                return (
                                  <div key={a.id} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
                                    <span className="font-medium">{req?.student.name}（{req?.student.grade}）</span>
                                    <div className="flex flex-wrap gap-1">
                                      {req && Object.entries(req.subjects).map(([subj, cnt]) => (
                                        <span key={subj} className="text-xs text-gray-500">{subj}: {cnt}コマ</span>
                                      ))}
                                    </div>
                                    <Badge className={`ml-auto ${ast.color}`}>{ast.label}</Badge>
                                  </div>
                                )
                              })}
                            </div>

                            {/* 講師の回答一覧グリッド（全アサイン分をOR結合） */}
                            <div>
                              <h3 className="text-sm font-semibold mb-2">担当可能日時（いずれかの生徒でOKとした枠）</h3>
                              <div className="overflow-x-auto">
                                <table className="text-xs border-collapse w-full">
                                  <thead>
                                    <tr>
                                      <th className="sticky left-0 bg-white z-10 px-2 py-1 border text-left min-w-[70px]">日付</th>
                                      {timeSlots.map(slot => (
                                        <th key={slot.id} className="px-1 py-1 border text-center min-w-[70px] whitespace-nowrap">
                                          {formatSlotTime(slot)}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dates.map(dateStr => {
                                      const isClosed = closedDates.has(dateStr)
                                      return (
                                        <tr key={dateStr} className={isClosed ? 'bg-gray-200/60' : ''}>
                                          <td className={`sticky left-0 z-10 px-2 py-1 border font-medium whitespace-nowrap ${isClosed ? 'bg-gray-200' : 'bg-white'}`}>
                                            {formatDate(dateStr)}
                                            {isClosed && <span className="ml-1 text-[10px] text-gray-500">休館</span>}
                                          </td>
                                          {isClosed ? (
                                            <td colSpan={timeSlots.length} className="px-1 py-1 border text-center text-xs text-gray-400">
                                              休館日
                                            </td>
                                          ) : (
                                            <>
                                              {timeSlots.map(slot => {
                                                const isOk = teacherResponses.some(r => r.available_date === dateStr && r.time_slot_id === slot.id)
                                                const comiruStudents = getComiruStudents(teacher.display_name, dateStr, slot)
                                                const busy = comiruStudents.length > 0
                                                return (
                                                  <td
                                                    key={slot.id}
                                                    className={`px-1 py-1.5 border text-center cursor-pointer transition-all group ${
                                                      busy
                                                        ? 'bg-orange-50 hover:bg-orange-100'
                                                        : isOk
                                                          ? 'bg-green-50 hover:bg-green-100'
                                                          : 'hover:bg-blue-50'
                                                    }`}
                                                    onClick={() => {
                                                      for (const a of teacherAssignments) {
                                                        handleToggleTeacherOk(a.id, dateStr, slot.id)
                                                      }
                                                    }}
                                                    title={isOk ? 'クリックでOKを取消' : 'クリックでOKに設定'}
                                                  >
                                                    {busy ? (
                                                      <span className="text-orange-700 text-[11px] font-medium">{comiruStudents.join(', ')}<span className="text-orange-400 text-[9px] ml-0.5">(授業)</span></span>
                                                    ) : isOk ? (
                                                      <span className="text-green-700 font-bold text-xs">OK</span>
                                                    ) : (
                                                      <span className="text-gray-300 group-hover:text-blue-400 transition-colors">-</span>
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
                          </CardContent>
                        )}
                      </Card>
                    )
                  })
              )}
            </div>
          )}

          {/* 生徒別ビュー */}
          {viewMode === 'student' && (requests.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-500">まだ生徒の回答がありません</CardContent></Card>
          ) : (
            requests.map(req => {
              const isExpanded = expandedRequests.has(req.id)
              const reqAssignments = assignments.filter(a => a.request_id === req.id)
              const reqConfirmations = confirmations.filter(c => c.request_id === req.id)
              const reqNgSlots = ngSlots.filter(n => n.request_id === req.id)
              const ngAllDays = new Set(reqNgSlots.filter(n => n.time_slot_id === null).map(n => n.ng_date))
              const ngSet = new Set<string>()
              reqNgSlots.forEach(n => {
                if (n.time_slot_id === null) {
                  timeSlots.forEach(ts => ngSet.add(`${n.ng_date}|${ts.id}`))
                } else {
                  ngSet.add(`${n.ng_date}|${n.time_slot_id}`)
                }
              })
              const totalRequired = Object.values(req.subjects).reduce((a, b) => a + b, 0)
              const totalConfirmed = reqConfirmations.length
              const allConfirmed = totalConfirmed >= totalRequired && totalRequired > 0

              return (
                <Card key={req.id} className={allConfirmed ? 'ring-2 ring-blue-400' : ''}>
                  <CardHeader className="cursor-pointer py-3" onClick={() => toggleExpand(req.id)}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <CardTitle className="text-base">
                          {req.student.student_number} {req.student.name}（{req.student.grade}）
                        </CardTitle>
                        {allConfirmed && <Badge className="bg-blue-500 text-white">全確定</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {Object.entries(req.subjects).map(([subj, cnt]) => {
                          const confirmed = reqConfirmations.filter(c => c.subject === subj).length
                          const isComplete = confirmed >= cnt
                          return (
                            <span key={subj} className={`text-xs px-2 py-1 rounded-md border font-medium ${
                              isComplete
                                ? 'bg-blue-50 border-blue-300 text-blue-800'
                                : confirmed > 0
                                  ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                                  : 'bg-gray-50 border-gray-200 text-gray-600'
                            }`}>
                              {subj} {confirmed}/{cnt}コマ
                            </span>
                          )
                        })}
                        <Badge className={reqAssignments.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                          講師{reqAssignments.length}名
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0 space-y-4">
                      {req.note && (
                        <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded">要望: {req.note}</p>
                      )}

                      {/* 講師アサイン */}
                      <div>
                        <h3 className="text-sm font-semibold mb-2">担当講師</h3>
                        <div className="space-y-2">
                          {reqAssignments.map(a => {
                            const ast = assignmentStatusLabels[a.status]
                            return (
                              <div key={a.id} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
                                <span className="font-medium">{a.teacher.display_name}</span>
                                <Badge className={ast.color}>{ast.label}</Badge>
                                <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => copyTeacherUrl(a.token)}>
                                  <Copy className="h-3 w-3 mr-1" />URL
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7" onClick={() => window.open(`/lecture-scheduling/teacher/${a.token}`, '_blank')}>
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => setRemoveTarget(a)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )
                          })}
                        </div>

                        {/* 新規アサイン */}
                        {assigningRequestId === req.id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <select
                              value={assignTeacherId}
                              onChange={e => setAssignTeacherId(e.target.value)}
                              className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                            >
                              <option value="">講師を選択</option>
                              {teachers
                                .filter(t => !reqAssignments.some(a => a.teacher_id === t.id))
                                .map(t => (
                                  <option key={t.id} value={t.id}>{t.display_name}</option>
                                ))}
                            </select>
                            <Button size="sm" onClick={() => handleAssignTeacher(req.id)} disabled={!assignTeacherId}>
                              追加
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setAssigningRequestId(null); setAssignTeacherId('') }}>
                              キャンセル
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => setAssigningRequestId(req.id)}>
                            <Plus className="h-3 w-3 mr-1" />講師を追加
                          </Button>
                        )}
                      </div>

                      {/* NG日時 + 講師回答グリッド */}
                      <div>
                        <h3 className="text-sm font-semibold mb-2">日程表</h3>
                        <div className="overflow-x-auto">
                          <table className="text-xs border-collapse w-full">
                            <thead>
                              <tr>
                                <th className="sticky left-0 bg-white z-10 px-2 py-1 border text-left min-w-[70px]">日付</th>
                                {timeSlots.map(slot => (
                                  <th key={slot.id} className="px-1 py-1 border text-center min-w-[70px] whitespace-nowrap">
                                    {formatSlotTime(slot)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {dates.map(dateStr => {
                                const isAllDayNg = ngAllDays.has(dateStr)
                                const isClosed = closedDates.has(dateStr)
                                return (
                                  <tr key={dateStr} className={isClosed ? 'bg-gray-200/60' : ''}>
                                    <td className={`sticky left-0 z-10 px-2 py-1 border font-medium whitespace-nowrap ${isClosed ? 'bg-gray-200' : 'bg-white'}`}>
                                      {formatDate(dateStr)}
                                      {isClosed && <span className="ml-1 text-[10px] text-gray-500">休館</span>}
                                    </td>
                                    {isClosed ? (
                                      <td colSpan={timeSlots.length} className="px-1 py-1 border text-center text-xs text-gray-400">
                                        休館日
                                      </td>
                                    ) : (
                                      <>
                                    {timeSlots.map(slot => {
                                      const key = `${dateStr}|${slot.id}`
                                      const isNg = ngSet.has(key) || isAllDayNg

                                      // OKと回答した講師を全員取得
                                      const allOkTeachers = reqAssignments
                                        .filter(a => responses.some(r =>
                                          r.assignment_id === a.id &&
                                          r.available_date === dateStr &&
                                          r.time_slot_id === slot.id
                                        ))

                                      // 空き講師のみ表示（comiru授業ありの講師は除外）
                                      const availableTeachers = allOkTeachers
                                        .filter(a => !isComiruBusy(a.teacher.display_name, dateStr, slot))
                                        .map(a => a.teacher.display_name)

                                      // 確定データ
                                      const existingConfirmation = reqConfirmations.find(
                                        c => c.confirmed_date === dateStr && c.time_slot_id === slot.id
                                      )
                                      const confirmedTeacher = existingConfirmation
                                        ? reqAssignments.find(a => a.id === existingConfirmation.assignment_id)?.teacher.display_name
                                        : null

                                      // セルの背景色: 確定最優先、次にNG、次にOK講師あり
                                      const bgClass = existingConfirmation
                                        ? 'bg-blue-100 hover:bg-blue-200 ring-2 ring-inset ring-blue-400'
                                        : isNg
                                          ? (availableTeachers.length > 0 ? 'bg-red-50 hover:bg-red-100' : 'bg-red-100 hover:bg-red-200')
                                          : availableTeachers.length > 0
                                              ? 'bg-green-50 hover:bg-green-100'
                                              : 'hover:bg-blue-50'

                                      return (
                                        <td
                                          key={slot.id}
                                          className={`px-1 py-1.5 border text-center cursor-pointer transition-all group relative ${bgClass}`}
                                          onClick={() => {
                                            if (confirmMode) {
                                              if (isNg && !existingConfirmation) {
                                                handleToggleStudentNg(req.id, dateStr, slot.id)
                                              } else if (availableTeachers.length > 0 || existingConfirmation) {
                                                // 確定ダイアログにはbusy除外済の講師のみ渡す
                                                const availableOkTeachers = allOkTeachers
                                                  .filter(a => !isComiruBusy(a.teacher.display_name, dateStr, slot))
                                                setConfirmPopover({
                                                  requestId: req.id,
                                                  date: dateStr,
                                                  slotId: slot.id,
                                                  okTeachers: availableOkTeachers,
                                                  subjects: req.subjects,
                                                })
                                                if (existingConfirmation) {
                                                  setConfirmTeacherId(existingConfirmation.assignment_id)
                                                  setConfirmSubject(existingConfirmation.subject)
                                                } else {
                                                  setConfirmTeacherId('')
                                                  setConfirmSubject('')
                                                }
                                              }
                                            } else {
                                              handleToggleStudentNg(req.id, dateStr, slot.id)
                                            }
                                          }}
                                          title={confirmMode
                                            ? (existingConfirmation ? 'クリックで確定内容を編集' : allOkTeachers.length > 0 ? 'クリックで講師・科目を確定' : '')
                                            : (isNg ? 'クリックでNGを解除' : 'クリックでNGに設定')
                                          }
                                        >
                                          {existingConfirmation ? (
                                            <div className="leading-tight">
                                              <div className="text-[11px] font-bold text-blue-800">{confirmedTeacher}</div>
                                              <div className="text-[10px] text-blue-600">{existingConfirmation.subject}</div>
                                            </div>
                                          ) : (
                                            <>
                                              {isNg && (
                                                <div className="flex items-center justify-center gap-0.5 mb-0.5">
                                                  <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">NG</span>
                                                </div>
                                              )}
                                              {availableTeachers.length > 0 ? (
                                                <div className="leading-tight">
                                                  {availableTeachers.map((name, i) => (
                                                    <div key={`a-${i}`} className={`text-[11px] font-medium ${isNg ? 'text-green-400' : 'text-green-700'}`}>{name}</div>
                                                  ))}
                                                </div>
                                              ) : !isNg ? (
                                                <span className="text-gray-300 group-hover:text-blue-400 transition-colors">-</span>
                                              ) : null}
                                            </>
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
                    </CardContent>
                  )}
                </Card>
              )
            })
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={() => setRemoveTarget(null)}
        title="講師アサインの解除"
        description={`「${removeTarget?.teacher?.display_name}」のアサインを解除しますか？${removeTarget?.status === 'responded' ? '回答済みのデータも削除されます。' : ''}`}
        onConfirm={handleRemoveAssignment}
        variant="destructive"
      />

      {/* 生徒個別URLダイアログ */}
      <Dialog open={showStudentTokenDialog} onOpenChange={(open) => { setShowStudentTokenDialog(open); if (!open) setTokenSearchQuery('') }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              生徒個別URL管理
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              個別URLを使うと、生徒ごとにcomiruの通常授業が自動反映されます。
            </p>

            {/* 一括発行ボタン */}
            {(() => {
              const issuedIds = new Set(studentTokens.map(t => t.student_id))
              const unissuedStudents = allStudents.filter(s => !issuedIds.has(s.id))
              return unissuedStudents.length > 0 ? (
                <Button
                  size="sm"
                  onClick={() => handleGenerateStudentTokens(allStudents.map(s => s.id))}
                  disabled={generatingTokens}
                  className="w-full"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {generatingTokens ? '発行中...' : `全生徒にURLを一括発行（未発行: ${unissuedStudents.length}名）`}
                </Button>
              ) : allStudents.length > 0 ? (
                <p className="text-sm text-green-600 text-center py-1">全生徒のURLが発行済みです</p>
              ) : null
            })()}

            {/* 発行済みURL一覧 */}
            {studentTokens.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">発行済み（{studentTokens.length}名）</h3>
                  {/* 全URLコピー */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const lines = studentTokens.map(st =>
                        `${st.student.name}\t${window.location.origin}/lecture-scheduling/student/${st.token}`
                      ).join('\n')
                      navigator.clipboard.writeText(lines)
                      toast.success('全URLをコピーしました（タブ区切り）')
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />全URLコピー
                  </Button>
                </div>

                {/* 検索 */}
                {studentTokens.length > 5 && (
                  <input
                    type="text"
                    placeholder="名前で検索..."
                    value={tokenSearchQuery}
                    onChange={e => setTokenSearchQuery(e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                  />
                )}

                {studentTokens
                  .filter(st => !tokenSearchQuery || st.student.name.includes(tokenSearchQuery) || st.student.student_number.includes(tokenSearchQuery))
                  .map(st => {
                    const hasResponse = requests.some(r => r.student_id === st.student_id)
                    return (
                      <div key={st.id} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
                        <span className="font-medium flex-1 truncate">
                          {st.student.student_number} {st.student.name}（{st.student.grade}）
                        </span>
                        {hasResponse && <Badge className="bg-green-100 text-green-700 text-[10px] shrink-0">回答済</Badge>}
                        <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={() => copyStudentIndividualUrl(st.token)}>
                          <Copy className="h-3 w-3 mr-1" />URL
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={() => window.open(`/lecture-scheduling/student/${st.token}`, '_blank')}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    )
                  })
                }
              </div>
            )}

            {studentTokens.length === 0 && allStudents.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">生徒データがありません</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 確定ダイアログ */}
      <Dialog open={!!confirmPopover} onOpenChange={() => { setConfirmPopover(null); setConfirmTeacherId(''); setConfirmSubject('') }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {confirmPopover && `${formatDate(confirmPopover.date)} — コマ確定`}
            </DialogTitle>
          </DialogHeader>
          {confirmPopover && (() => {
            const existingConf = confirmations.find(
              c => c.request_id === confirmPopover.requestId && c.confirmed_date === confirmPopover.date && c.time_slot_id === confirmPopover.slotId
            )
            return (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">担当講師</label>
                  <select
                    value={confirmTeacherId}
                    onChange={e => setConfirmTeacherId(e.target.value)}
                    className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">選択してください</option>
                    {confirmPopover.okTeachers.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.teacher.display_name}
                        {isComiruBusy(a.teacher.display_name, confirmPopover.date, timeSlots.find(s => s.id === confirmPopover.slotId)!) ? ' (授業あり)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">科目</label>
                  <select
                    value={confirmSubject}
                    onChange={e => setConfirmSubject(e.target.value)}
                    className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">選択してください</option>
                    {Object.entries(confirmPopover.subjects).map(([subj, cnt]) => {
                      const confirmed = confirmations.filter(c => c.request_id === confirmPopover.requestId && c.subject === subj).length
                      return (
                        <option key={subj} value={subj}>
                          {subj}（{confirmed}/{cnt}コマ確定済）
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    onClick={handleConfirm}
                    disabled={!confirmTeacherId || !confirmSubject}
                  >
                    確定
                  </Button>
                  {existingConf && (
                    <Button variant="destructive" onClick={handleDeleteConfirmation}>
                      解除
                    </Button>
                  )}
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Plus, Copy, Trash2, ExternalLink, ChevronDown, ChevronRight, Check } from 'lucide-react'

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`
}

function formatSlotTime(slot: TimeSlot): string {
  return `${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`
}

function generateDateRange(startDate: string, endDate: string, closedDates: Set<string>): string[] {
  const dates: string[] = []
  const current = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (current <= end) {
    const ds = current.toISOString().split('T')[0]
    if (!closedDates.has(ds)) dates.push(ds)
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

  // UI状態
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set())
  const [assignTeacherId, setAssignTeacherId] = useState('')
  const [assigningRequestId, setAssigningRequestId] = useState<string | null>(null)

  const fetchPeriods = useCallback(async () => {
    const res = await fetch('/api/lecture-scheduling/periods')
    if (res.ok) setPeriods(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchPeriods() }, [fetchPeriods])

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
    }
    setOverviewLoading(false)
  }, [])

  useEffect(() => {
    if (selectedPeriod) fetchOverview(selectedPeriod.id)
  }, [selectedPeriod, fetchOverview])

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

  const handleRemoveAssignment = async (assignmentId: string) => {
    const res = await fetch(`/api/lecture-scheduling/admin/assignments/${assignmentId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('アサインを解除しました')
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
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); copyStudentUrl(p.student_token) }}>
                        <Copy className="h-3 w-3 mr-1" />生徒URL
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
  const dates = generateDateRange(selectedPeriod.start_date, selectedPeriod.end_date, closedDates)
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
        <Button size="sm" variant="outline" onClick={() => copyStudentUrl(selectedPeriod.student_token)}>
          <Copy className="h-3 w-3 mr-1" />生徒用URLコピー
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
      </div>

      {overviewLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-4">
          {/* 回答状況サマリ */}
          <Card>
            <CardContent className="py-4">
              <div className="flex gap-6 text-sm">
                <span>生徒回答: <strong>{requests.length}件</strong></span>
                <span>講師アサイン: <strong>{assignments.length}件</strong></span>
                <span>講師回答済: <strong>{assignments.filter(a => a.status === 'responded').length}件</strong></span>
              </div>
            </CardContent>
          </Card>

          {requests.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-500">まだ生徒の回答がありません</CardContent></Card>
          ) : (
            requests.map(req => {
              const isExpanded = expandedRequests.has(req.id)
              const reqAssignments = assignments.filter(a => a.request_id === req.id)
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

              return (
                <Card key={req.id}>
                  <CardHeader className="cursor-pointer py-3" onClick={() => toggleExpand(req.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <CardTitle className="text-base">
                          {req.student.student_number} {req.student.name}（{req.student.grade}）
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {Object.entries(req.subjects).map(([subj, cnt]) => (
                          <Badge key={subj} variant="outline" className="text-xs">{subj}: {cnt}</Badge>
                        ))}
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
                                <Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => handleRemoveAssignment(a.id)}>
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
                                  <th key={slot.id} className="px-1 py-1 border text-center min-w-[55px] whitespace-nowrap">
                                    {formatSlotTime(slot)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {dates.map(dateStr => {
                                const isAllDayNg = ngAllDays.has(dateStr)
                                return (
                                  <tr key={dateStr}>
                                    <td className="sticky left-0 bg-white z-10 px-2 py-1 border font-medium whitespace-nowrap">
                                      {formatDate(dateStr)}
                                    </td>
                                    {timeSlots.map(slot => {
                                      const key = `${dateStr}|${slot.id}`
                                      const isNg = ngSet.has(key) || isAllDayNg

                                      // 講師ごとの回答を確認
                                      const teacherOks = reqAssignments
                                        .filter(a => {
                                          return responses.some(r =>
                                            r.assignment_id === a.id &&
                                            r.available_date === dateStr &&
                                            r.time_slot_id === slot.id
                                          )
                                        })
                                        .map(a => a.teacher.display_name)

                                      return (
                                        <td key={slot.id} className={`px-1 py-1 border text-center ${
                                          isNg ? 'bg-red-50' : teacherOks.length > 0 ? 'bg-green-50' : ''
                                        }`}>
                                          {isNg ? (
                                            <span className="text-red-400">NG</span>
                                          ) : teacherOks.length > 0 ? (
                                            <span className="text-green-700" title={teacherOks.join(', ')}>
                                              {teacherOks.length === 1 ? teacherOks[0].slice(0, 3) : `${teacherOks.length}名`}
                                            </span>
                                          ) : (
                                            <span className="text-gray-300">-</span>
                                          )}
                                        </td>
                                      )
                                    })}
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
    </div>
  )
}

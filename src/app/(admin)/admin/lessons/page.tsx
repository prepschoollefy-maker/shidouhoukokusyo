'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
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

interface Booth {
  id: string
  booth_number: number
  label: string
}

interface StudentOption {
  id: string
  name: string
}

interface TeacherOption {
  id: string
  display_name: string
}

interface SubjectOption {
  id: string
  name: string
}

interface Lesson {
  id: string
  student_id: string
  teacher_id: string
  subject_id: string | null
  lesson_date: string
  time_slot_id: string
  booth_id: string | null
  lesson_type: string
  status: string
  template_id: string | null
  notes: string
  student: StudentOption
  teacher: TeacherOption
  subject: SubjectOption | null
  time_slot: TimeSlot
  booth: Booth | null
}

interface FormData {
  student_id: string
  teacher_id: string
  subject_id: string
  lesson_date: string
  time_slot_id: string
  booth_id: string
  lesson_type: string
  status: string
  notes: string
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

const STATUS_OPTIONS = [
  { value: 'scheduled', label: '予定' },
  { value: 'completed', label: '完了' },
  { value: 'cancelled', label: 'キャンセル' },
  { value: 'rescheduled', label: '振替済' },
] as const

const LESSON_TYPE_OPTIONS = [
  { value: 'regular', label: '通常' },
  { value: 'intensive', label: '講習' },
  { value: 'makeup', label: '振替' },
] as const

const emptyForm: FormData = {
  student_id: '',
  teacher_id: '',
  subject_id: '',
  lesson_date: '',
  time_slot_id: '',
  booth_id: '',
  lesson_type: 'regular',
  status: 'scheduled',
  notes: '',
}

// ─── Main Page ───────────────────────────

export default function WeeklySchedulePage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [booths, setBooths] = useState<Booth[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [loading, setLoading] = useState(true)

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const fetchMasters = useCallback(async () => {
    const [slotsRes, boothsRes, studentsRes, teachersRes, subjectsRes] = await Promise.all([
      fetch('/api/master/time-slots'),
      fetch('/api/master/booths'),
      fetch('/api/students'),
      fetch('/api/teachers'),
      fetch('/api/master/subjects'),
    ])
    const [slotsJson, boothsJson, studentsJson, teachersJson, subjectsJson] = await Promise.all([
      slotsRes.json(), boothsRes.json(), studentsRes.json(), teachersRes.json(), subjectsRes.json(),
    ])

    setTimeSlots(slotsJson.data || [])
    setBooths((boothsJson.data || []).filter((b: Booth & { is_active?: boolean }) => b.is_active !== false))
    setStudents(studentsJson.data || [])
    setTeachers(teachersJson.data || [])
    setSubjects(subjectsJson.data || [])
  }, [])

  const fetchLessons = useCallback(async () => {
    const we = endOfWeek(weekStart, { weekStartsOn: 1 })
    const startDate = format(weekStart, 'yyyy-MM-dd')
    const endDate = format(we, 'yyyy-MM-dd')
    const res = await fetch(`/api/lessons?start_date=${startDate}&end_date=${endDate}`)
    const json = await res.json()
    setLessons(json.data || [])
    setLoading(false)
  }, [weekStart])

  useEffect(() => { fetchMasters() }, [fetchMasters])
  useEffect(() => { fetchLessons() }, [fetchLessons])

  const goToWeek = (offset: number) => {
    setLoading(true)
    setWeekStart((prev) => addWeeks(prev, offset))
  }

  const goToThisWeek = () => {
    setLoading(true)
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  const openCreate = (date: Date, timeSlotId?: string) => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      lesson_date: format(date, 'yyyy-MM-dd'),
      time_slot_id: timeSlotId || (timeSlots[0]?.id || ''),
    })
    setDialogOpen(true)
  }

  const openEdit = (lesson: Lesson) => {
    setEditingId(lesson.id)
    setForm({
      student_id: lesson.student_id,
      teacher_id: lesson.teacher_id,
      subject_id: lesson.subject_id || '',
      lesson_date: lesson.lesson_date,
      time_slot_id: lesson.time_slot_id,
      booth_id: lesson.booth_id || '',
      lesson_type: lesson.lesson_type,
      status: lesson.status,
      notes: lesson.notes,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.student_id || !form.teacher_id || !form.lesson_date || !form.time_slot_id) {
      toast.error('生徒・講師・日付・コマは必須です')
      return
    }

    const payload = {
      ...form,
      subject_id: form.subject_id || null,
      booth_id: form.booth_id || null,
    }

    try {
      const url = editingId ? `/api/lessons/${editingId}` : '/api/lessons'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || '保存に失敗しました')
        return
      }
      toast.success(editingId ? '更新しました' : '追加しました')
      setDialogOpen(false)
      fetchLessons()
    } catch {
      toast.error('保存に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/lessons/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error || '削除に失敗しました')
        return
      }
      toast.success('削除しました')
      fetchLessons()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const handleReschedule = async (lesson: Lesson) => {
    const reason = window.prompt('振替理由を入力してください（任意）')
    if (reason === null) return // キャンセル
    try {
      const res = await fetch('/api/reschedule-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_id: lesson.id,
          requested_by: '管理者',
          reason,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || '振替申請に失敗しました')
        return
      }
      toast.success('振替申請を登録しました（振替管理ページで振替先を指定してください）')
      fetchLessons()
    } catch {
      toast.error('振替申請に失敗しました')
    }
  }

  if (loading && timeSlots.length === 0) return <LoadingSpinner />

  // 授業をマトリクス化: matrix[dateStr][time_slot_id] = Lesson[]
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">週間時間割</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goToWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToThisWeek}>
            今週
          </Button>
          <Button variant="outline" size="icon" onClick={() => goToWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2">
            {format(weekStart, 'yyyy年M月d日', { locale: ja })} 〜 {format(weekEnd, 'M月d日', { locale: ja })}
          </span>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted text-sm w-20">コマ</th>
                  {weekDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const dayLabel = format(day, 'E', { locale: ja })
                    const isSat = day.getDay() === 6
                    const isSun = day.getDay() === 0
                    return (
                      <th
                        key={dateStr}
                        className={`border p-2 text-sm ${
                          isToday(day) ? 'bg-blue-100' : 'bg-muted'
                        } ${isSat ? 'text-blue-600' : ''} ${isSun ? 'text-red-600' : ''}`}
                      >
                        <div>{format(day, 'M/d')}</div>
                        <div className="text-xs">({dayLabel})</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot) => (
                  <tr key={slot.id}>
                    <td className="border p-2 text-center bg-muted/50">
                      <div className="font-medium text-sm">{slot.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {slot.start_time.slice(0, 5)}
                      </div>
                    </td>
                    {weekDays.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const cellLessons = matrix[dateStr]?.[slot.id] || []
                      return (
                        <td
                          key={dateStr}
                          className={`border p-1 align-top min-w-[120px] cursor-pointer hover:bg-muted/30 ${
                            isToday(day) ? 'bg-blue-50/50' : ''
                          }`}
                          onClick={() => openCreate(day, slot.id)}
                        >
                          <div className="space-y-1">
                            {cellLessons.map((l) => (
                              <LessonCard
                                key={l.id}
                                lesson={l}
                                onEdit={() => openEdit(l)}
                                onDelete={() => setDeleteTarget(l.id)}
                                onReschedule={() => handleReschedule(l)}
                              />
                            ))}
                          </div>
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

      {/* 追加/編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? '授業編集' : '授業追加'}</DialogTitle>
            <DialogDescription>
              授業を{editingId ? '編集' : '追加'}します
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>生徒 *</Label>
              <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                <SelectTrigger><SelectValue placeholder="生徒を選択" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>講師 *</Label>
              <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
                <SelectTrigger><SelectValue placeholder="講師を選択" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>科目</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger><SelectValue placeholder="科目を選択" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>日付 *</Label>
                <Input
                  type="date"
                  value={form.lesson_date}
                  onChange={(e) => setForm({ ...form, lesson_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>コマ *</Label>
                <Select value={form.time_slot_id} onValueChange={(v) => setForm({ ...form, time_slot_id: v })}>
                  <SelectTrigger><SelectValue placeholder="コマを選択" /></SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}（{s.start_time.slice(0, 5)}）</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>ブース</Label>
                <Select value={form.booth_id} onValueChange={(v) => setForm({ ...form, booth_id: v })}>
                  <SelectTrigger><SelectValue placeholder="ブースを選択" /></SelectTrigger>
                  <SelectContent>
                    {booths.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>授業種別</Label>
                <Select value={form.lesson_type} onValueChange={(v) => setForm({ ...form, lesson_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LESSON_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editingId && (
              <div className="grid gap-2">
                <Label>ステータス</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>備考</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="メモ"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave}>{editingId ? '更新' : '追加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="授業を削除"
        description="この授業を削除しますか？"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
      />
    </div>
  )
}

// ─── 授業カード ───────────────────────────

function LessonCard({
  lesson: l,
  onEdit,
  onDelete,
  onReschedule,
}: {
  lesson: Lesson
  onEdit: () => void
  onDelete: () => void
  onReschedule: () => void
}) {
  const colorClass = LESSON_TYPE_COLORS[l.lesson_type] || LESSON_TYPE_COLORS.regular
  const isCancelled = l.status === 'cancelled' || l.status === 'rescheduled'

  return (
    <div
      className={`rounded p-1.5 text-xs border ${colorClass} ${isCancelled ? 'opacity-40 line-through' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{l.student.name}</div>
          <div className="text-muted-foreground truncate">{l.teacher.display_name}</div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {l.subject && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                {l.subject.name}
              </Badge>
            )}
            {l.lesson_type !== 'regular' && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {LESSON_TYPE_LABELS[l.lesson_type]}
              </Badge>
            )}
          </div>
          {l.booth && (
            <div className="text-muted-foreground mt-0.5">{l.booth.label}</div>
          )}
        </div>
        <div className="flex flex-col gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          {!isCancelled && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onReschedule}>
              <ArrowLeftRight className="h-3 w-3 text-orange-500" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onDelete}>
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
        </div>
      </div>
    </div>
  )
}

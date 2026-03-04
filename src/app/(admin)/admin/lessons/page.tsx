'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  ChevronLeft, ChevronRight, Plus, ArrowLeftRight, Menu,
} from 'lucide-react'
import { toast } from 'sonner'
import { addDays, format } from 'date-fns'
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
  original_lesson_id: string | null
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

export default function SchedulePage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [booths, setBooths] = useState<Booth[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [loading, setLoading] = useState(true)

  const [currentDate, setCurrentDate] = useState(() => new Date())
  const dateStr = format(currentDate, 'yyyy-MM-dd')

  // ストックパネル
  const [stockOpen, setStockOpen] = useState(false)
  const [stock, setStock] = useState<Lesson[]>([])

  // 授業追加/編集ダイアログ
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // 振替先指定ダイアログ
  const [makeupOpen, setMakeupOpen] = useState(false)
  const [makeupTarget, setMakeupTarget] = useState<Lesson | null>(null)
  const [makeupForm, setMakeupForm] = useState({
    lesson_date: '',
    time_slot_id: '',
    teacher_id: '',
    booth_id: '',
  })

  // マスタデータ取得
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

  // 授業取得
  const fetchLessons = useCallback(async () => {
    const res = await fetch(`/api/lessons?start_date=${dateStr}&end_date=${dateStr}`)
    const json = await res.json()
    setLessons(json.data || [])
    setLoading(false)
  }, [dateStr])

  // 振替ストック取得
  const fetchStock = useCallback(async () => {
    const res = await fetch('/api/lessons/reschedule-stock')
    const json = await res.json()
    setStock(json.data || [])
  }, [])

  useEffect(() => { fetchMasters() }, [fetchMasters])
  useEffect(() => { fetchLessons() }, [fetchLessons])
  useEffect(() => { fetchStock() }, [fetchStock])

  // 講師列を決定: 当日授業を持つ講師のみ表示
  const columnTeachers = useMemo(() => {
    const teacherIds = new Set(lessons.map((l) => l.teacher_id))
    return teachers.filter((t) => teacherIds.has(t.id))
  }, [lessons, teachers])

  // マトリクスデータ: matrix[time_slot_id][teacher_id] = Lesson[]
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, Lesson[]>> = {}
    for (const slot of timeSlots) {
      m[slot.id] = {}
      for (const t of columnTeachers) {
        m[slot.id][t.id] = []
      }
    }
    for (const l of lessons) {
      if (m[l.time_slot_id]?.[l.teacher_id]) {
        m[l.time_slot_id][l.teacher_id].push(l)
      }
    }
    return m
  }, [timeSlots, columnTeachers, lessons])

  // ナビゲーション
  const navigate = (offset: number) => {
    setLoading(true)
    setCurrentDate((prev) => addDays(prev, offset))
  }
  const goToToday = () => {
    setLoading(true)
    setCurrentDate(new Date())
  }

  // 授業追加/編集
  const openCreate = (timeSlotId?: string, teacherId?: string) => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      lesson_date: dateStr,
      time_slot_id: timeSlotId || (timeSlots[0]?.id || ''),
      teacher_id: teacherId || '',
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
      fetchStock()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  // 振替（status → rescheduled）
  const handleReschedule = async (lessonId: string) => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/reschedule`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || '振替に失敗しました')
        return
      }
      toast.success('振替済みにしました')
      setDialogOpen(false)
      fetchLessons()
      fetchStock()
    } catch {
      toast.error('振替に失敗しました')
    }
  }

  // キャンセル（status → cancelled）
  const handleCancel = async (lessonId: string) => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'キャンセルに失敗しました')
        return
      }
      toast.success('キャンセルしました')
      setDialogOpen(false)
      fetchLessons()
    } catch {
      toast.error('キャンセルに失敗しました')
    }
  }

  // 振替取消
  const handleUndoReschedule = async (lessonId: string) => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/reschedule`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || '振替取消に失敗しました')
        return
      }
      toast.success('振替を取消しました')
      fetchLessons()
      fetchStock()
    } catch {
      toast.error('振替取消に失敗しました')
    }
  }

  // 振替先指定ダイアログを開く
  const openMakeup = (originalLesson: Lesson) => {
    setMakeupTarget(originalLesson)
    setMakeupForm({
      lesson_date: '',
      time_slot_id: timeSlots[0]?.id || '',
      teacher_id: originalLesson.teacher_id || '',
      booth_id: '',
    })
    setMakeupOpen(true)
  }

  const handleMakeup = async () => {
    if (!makeupTarget) return
    if (!makeupForm.lesson_date || !makeupForm.time_slot_id || !makeupForm.teacher_id) {
      toast.error('日付・コマ・講師は必須です')
      return
    }
    try {
      const res = await fetch('/api/lessons/makeup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_lesson_id: makeupTarget.id,
          lesson_date: makeupForm.lesson_date,
          time_slot_id: makeupForm.time_slot_id,
          teacher_id: makeupForm.teacher_id,
          booth_id: makeupForm.booth_id || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || '振替授業の作成に失敗しました')
        return
      }
      toast.success('振替授業を作成しました')
      setMakeupOpen(false)
      setMakeupTarget(null)
      fetchLessons()
      fetchStock()
    } catch {
      toast.error('振替授業の作成に失敗しました')
    }
  }

  if (loading && timeSlots.length === 0) return <LoadingSpinner />

  const headerLabel = format(currentDate, 'yyyy年M月d日（E）', { locale: ja })

  return (
    <div className="space-y-4">
      {/* ─── ヘッダー ─── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStockOpen(true)}
          >
            <Menu className="h-4 w-4 mr-1" />
            ストック
            {stock.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">
                {stock.length}
              </Badge>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[160px] text-center">{headerLabel}</span>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>今日</Button>
          <Input
            type="date"
            value={dateStr}
            onChange={(e) => {
              if (e.target.value) {
                setLoading(true)
                setCurrentDate(new Date(e.target.value + 'T00:00:00'))
              }
            }}
            className="w-40"
          />
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-1" />授業追加
          </Button>
        </div>
      </div>

      {/* ─── 日次マトリクス ─── */}
      <div className="overflow-x-auto border rounded-lg">
        {loading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : columnTeachers.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            この日のシフト・授業はありません
          </div>
        ) : (
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="border p-2 bg-muted text-sm w-20 sticky left-0 z-10">コマ</th>
                {columnTeachers.map((t) => (
                  <th key={t.id} className="border p-2 bg-muted text-sm min-w-[130px]">
                    {t.display_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot) => (
                <tr key={slot.id}>
                  <td className="border p-2 text-center bg-muted/50 sticky left-0 z-10">
                    <div className="font-medium text-sm">{slot.label}</div>
                    <div className="text-xs text-muted-foreground">{slot.start_time.slice(0, 5)}</div>
                  </td>
                  {columnTeachers.map((teacher) => {
                    const cellLessons = matrix[slot.id]?.[teacher.id] || []
                    return (
                      <td
                        key={teacher.id}
                        className="border p-1 align-top cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => openCreate(slot.id, teacher.id)}
                      >
                        <div className="space-y-1">
                          {cellLessons.map((l) => (
                            <LessonChip
                              key={l.id}
                              lesson={l}
                              onClick={() => openEdit(l)}
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
      </div>

      {/* ─── 振替ストックパネル (Sheet) ─── */}
      <Sheet open={stockOpen} onOpenChange={setStockOpen}>
        <SheetContent side="left" className="w-[340px] sm:max-w-[340px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>振替ストック</SheetTitle>
            <SheetDescription>振替済みの授業一覧（未消化）</SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-3">
            {stock.length === 0 ? (
              <p className="text-sm text-muted-foreground">振替ストックはありません</p>
            ) : (
              stock.map((l) => (
                <div key={l.id} className="border rounded-lg p-3 space-y-2">
                  <div className="font-medium text-sm">{l.student?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.lesson_date} {l.time_slot?.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {l.teacher?.display_name} / {l.subject?.name || '科目なし'}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => { openMakeup(l); setStockOpen(false) }}>
                      <ArrowLeftRight className="h-3 w-3 mr-1" />振替先を指定
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleUndoReschedule(l.id)}>
                      取消
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── 授業追加/編集ダイアログ ─── */}
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
            <div className="grid gap-2">
              <Label>備考</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="メモ"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingId && form.status === 'scheduled' && (
              <>
                <Button
                  variant="outline"
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={() => handleReschedule(editingId)}
                >
                  振替
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => handleCancel(editingId)}
                >
                  キャンセル
                </Button>
              </>
            )}
            {editingId && form.status === 'rescheduled' && (
              <Button
                variant="outline"
                onClick={() => handleUndoReschedule(editingId)}
              >
                振替取消
              </Button>
            )}
            {editingId && (
              <Button
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => { setDialogOpen(false); setDeleteTarget(editingId) }}
              >
                削除
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setDialogOpen(false)}>閉じる</Button>
            <Button onClick={handleSave}>{editingId ? '保存' : '追加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 振替先指定ダイアログ ─── */}
      <Dialog open={makeupOpen} onOpenChange={setMakeupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>振替先を指定</DialogTitle>
            <DialogDescription>
              {makeupTarget?.student?.name} の振替授業を作成します
              （元: {makeupTarget?.lesson_date} {makeupTarget?.time_slot?.label}）
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>振替先日付 *</Label>
              <Input
                type="date"
                value={makeupForm.lesson_date}
                onChange={(e) => setMakeupForm({ ...makeupForm, lesson_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>コマ *</Label>
              <Select value={makeupForm.time_slot_id} onValueChange={(v) => setMakeupForm({ ...makeupForm, time_slot_id: v })}>
                <SelectTrigger><SelectValue placeholder="コマを選択" /></SelectTrigger>
                <SelectContent>
                  {timeSlots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}（{s.start_time.slice(0, 5)}）</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>講師 *</Label>
              <Select value={makeupForm.teacher_id} onValueChange={(v) => setMakeupForm({ ...makeupForm, teacher_id: v })}>
                <SelectTrigger><SelectValue placeholder="講師を選択" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>ブース</Label>
              <Select value={makeupForm.booth_id} onValueChange={(v) => setMakeupForm({ ...makeupForm, booth_id: v })}>
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
            <Button variant="outline" onClick={() => setMakeupOpen(false)}>キャンセル</Button>
            <Button onClick={handleMakeup}>振替授業を作成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 削除確認 ─── */}
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

// ─── 授業チップ ───────────────────────────

function LessonChip({
  lesson: l,
  onClick,
}: {
  lesson: Lesson
  onClick: () => void
}) {
  const colorClass = LESSON_TYPE_COLORS[l.lesson_type] || LESSON_TYPE_COLORS.regular
  const isCancelled = l.status === 'cancelled' || l.status === 'rescheduled'

  return (
    <div
      className={`rounded p-1.5 text-xs border cursor-pointer ${colorClass} ${isCancelled ? 'opacity-40 line-through' : ''}`}
      onClick={(e) => { e.stopPropagation(); onClick() }}
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
}

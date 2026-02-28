'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Plus, Pencil, Trash2, CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'

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

interface Template {
  id: string
  student_id: string
  teacher_id: string
  subject_id: string | null
  day_of_week: number
  time_slot_id: string
  booth_id: string | null
  is_active: boolean
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
  day_of_week: number
  time_slot_id: string
  booth_id: string
  notes: string
}

const DAYS = ['日', '月', '火', '水', '木', '金', '土'] as const
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0] // 月〜日の順

const emptyForm: FormData = {
  student_id: '',
  teacher_id: '',
  subject_id: '',
  day_of_week: 1,
  time_slot_id: '',
  booth_id: '',
  notes: '',
}

// ─── Main Page ───────────────────────────

export default function LessonTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [booths, setBooths] = useState<Booth[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateDates, setGenerateDates] = useState({ start_date: '', end_date: '' })
  const [generating, setGenerating] = useState(false)

  const fetchAll = useCallback(async () => {
    const [tplRes, slotsRes, boothsRes, studentsRes, teachersRes, subjectsRes] = await Promise.all([
      fetch('/api/lesson-templates'),
      fetch('/api/master/time-slots'),
      fetch('/api/master/booths'),
      fetch('/api/students'),
      fetch('/api/teachers'),
      fetch('/api/master/subjects'),
    ])
    const [tplJson, slotsJson, boothsJson, studentsJson, teachersJson, subjectsJson] = await Promise.all([
      tplRes.json(), slotsRes.json(), boothsRes.json(), studentsRes.json(), teachersRes.json(), subjectsRes.json(),
    ])

    setTemplates(tplJson.data || [])
    setTimeSlots(slotsJson.data || [])
    setBooths((boothsJson.data || []).filter((b: Booth & { is_active?: boolean }) => b.is_active !== false))
    setStudents(studentsJson.data || [])
    setTeachers(teachersJson.data || [])
    setSubjects(subjectsJson.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const openCreate = (dayOfWeek?: number, timeSlotId?: string) => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      day_of_week: dayOfWeek ?? 1,
      time_slot_id: timeSlotId ?? (timeSlots[0]?.id || ''),
    })
    setDialogOpen(true)
  }

  const openEdit = (t: Template) => {
    setEditingId(t.id)
    setForm({
      student_id: t.student_id,
      teacher_id: t.teacher_id,
      subject_id: t.subject_id || '',
      day_of_week: t.day_of_week,
      time_slot_id: t.time_slot_id,
      booth_id: t.booth_id || '',
      notes: t.notes,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.student_id || !form.teacher_id || !form.time_slot_id) {
      toast.error('生徒・講師・時間枠は必須です')
      return
    }

    const payload = {
      ...form,
      subject_id: form.subject_id || null,
      booth_id: form.booth_id || null,
    }

    try {
      const url = editingId ? `/api/lesson-templates/${editingId}` : '/api/lesson-templates'
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
      fetchAll()
    } catch {
      toast.error('保存に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/lesson-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error || '削除に失敗しました')
        return
      }
      toast.success('削除しました')
      fetchAll()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const handleGenerate = async () => {
    if (!generateDates.start_date || !generateDates.end_date) {
      toast.error('日付範囲を指定してください')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/lessons/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generateDates),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || '生成に失敗しました')
        return
      }
      toast.success(json.message)
      setGenerateOpen(false)
    } catch {
      toast.error('生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <LoadingSpinner />

  // テンプレートをマトリクス化: matrix[day_of_week][time_slot_id] = Template[]
  const matrix: Record<number, Record<string, Template[]>> = {}
  for (const d of DAY_INDICES) {
    matrix[d] = {}
    for (const s of timeSlots) {
      matrix[d][s.id] = []
    }
  }
  for (const t of templates) {
    if (matrix[t.day_of_week]?.[t.time_slot_id]) {
      matrix[t.day_of_week][t.time_slot_id].push(t)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">通常授業テンプレート</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGenerateOpen(true)}>
            <CalendarPlus className="h-4 w-4 mr-1" />授業一括生成
          </Button>
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-1" />テンプレート追加
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="border p-2 bg-muted text-sm w-20">コマ</th>
                {DAY_INDICES.map((d) => (
                  <th key={d} className="border p-2 bg-muted text-sm">{DAYS[d]}曜</th>
                ))}
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
                  {DAY_INDICES.map((d) => {
                    const cellTemplates = matrix[d][slot.id] || []
                    return (
                      <td
                        key={d}
                        className="border p-1 align-top min-w-[120px] cursor-pointer hover:bg-muted/30"
                        onClick={() => openCreate(d, slot.id)}
                      >
                        <div className="space-y-1">
                          {cellTemplates.map((t) => (
                            <TemplateCard
                              key={t.id}
                              template={t}
                              onEdit={() => openEdit(t)}
                              onDelete={() => setDeleteTarget(t.id)}
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
        </CardContent>
      </Card>

      {/* 追加/編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'テンプレート編集' : 'テンプレート追加'}</DialogTitle>
            <DialogDescription>
              通常授業のテンプレートを{editingId ? '編集' : '追加'}します
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
                <Label>曜日 *</Label>
                <Select
                  value={String(form.day_of_week)}
                  onValueChange={(v) => setForm({ ...form, day_of_week: parseInt(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_INDICES.map((d) => (
                      <SelectItem key={d} value={String(d)}>{DAYS[d]}曜</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        title="テンプレートを削除"
        description="このテンプレートを削除しますか？"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
      />

      {/* 授業一括生成ダイアログ */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>授業一括生成</DialogTitle>
            <DialogDescription>
              有効なテンプレートから指定期間の授業を一括生成します
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>開始日</Label>
              <Input
                type="date"
                value={generateDates.start_date}
                onChange={(e) => setGenerateDates({ ...generateDates, start_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>終了日</Label>
              <Input
                type="date"
                value={generateDates.end_date}
                onChange={(e) => setGenerateDates({ ...generateDates, end_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>キャンセル</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? '生成中...' : '生成する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── テンプレートカード ───────────────────────────

function TemplateCard({
  template: t,
  onEdit,
  onDelete,
}: {
  template: Template
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`rounded p-1.5 text-xs border ${t.is_active ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{t.student.name}</div>
          <div className="text-muted-foreground truncate">{t.teacher.display_name}</div>
          {t.subject && (
            <Badge variant="secondary" className="mt-0.5 text-[10px] px-1 py-0">
              {t.subject.name}
            </Badge>
          )}
          {t.booth && (
            <div className="text-muted-foreground mt-0.5">{t.booth.label}</div>
          )}
        </div>
        <div className="flex flex-col gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onDelete}>
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
        </div>
      </div>
    </div>
  )
}

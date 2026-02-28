'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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

interface SlotAvailability {
  id: string
  time_slot_id: string
  day_type: string
  availability: string
  time_slots: TimeSlot
}

interface Booth {
  id: string
  booth_number: number
  label: string
  is_active: boolean
  sort_order: number
}

// ─── Main Page ───────────────────────────

export default function LessonMasterPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">授業マスタ管理</h2>
      <Tabs defaultValue="time-slots">
        <TabsList>
          <TabsTrigger value="time-slots">時間枠</TabsTrigger>
          <TabsTrigger value="availability">開講パターン</TabsTrigger>
          <TabsTrigger value="booths">ブース</TabsTrigger>
          <TabsTrigger value="shifts">講師シフト</TabsTrigger>
        </TabsList>
        <TabsContent value="time-slots"><TimeSlotsTab /></TabsContent>
        <TabsContent value="availability"><AvailabilityTab /></TabsContent>
        <TabsContent value="booths"><BoothsTab /></TabsContent>
        <TabsContent value="shifts"><InstructorShiftsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── 時間枠タブ ───────────────────────────

function TimeSlotsTab() {
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [newSlot, setNewSlot] = useState({ start_time: '', end_time: '' })

  const fetchSlots = async () => {
    const res = await fetch('/api/master/time-slots')
    const json = await res.json()
    setSlots(json.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchSlots() }, [])

  const handleAdd = async () => {
    if (!newSlot.start_time || !newSlot.end_time) return
    try {
      const nextNumber = slots.reduce((max, s) => Math.max(max, s.slot_number), 0) + 1
      await fetch('/api/master/time-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_number: nextNumber,
          label: `${nextNumber}限`,
          start_time: newSlot.start_time,
          end_time: newSlot.end_time,
          sort_order: nextNumber,
        }),
      })
      setNewSlot({ start_time: '', end_time: '' })
      toast.success('追加しました')
      fetchSlots()
    } catch { toast.error('追加に失敗しました') }
  }

  const handleUpdate = async (slot: TimeSlot, updates: Partial<TimeSlot>) => {
    try {
      await fetch(`/api/master/time-slots/${slot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...slot, ...updates }),
      })
      toast.success('更新しました')
      fetchSlots()
    } catch { toast.error('更新に失敗しました') }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/master/time-slots/${id}`, { method: 'DELETE' })
      toast.success('削除しました')
      fetchSlots()
    } catch { toast.error('削除に失敗しました') }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground whitespace-nowrap">新しいコマを追加:</span>
            <Input
              type="time"
              value={newSlot.start_time}
              onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
              placeholder="開始"
              className="w-36"
            />
            <span className="text-sm text-muted-foreground">〜</span>
            <Input
              type="time"
              value={newSlot.end_time}
              onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
              placeholder="終了"
              className="w-36"
            />
            <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1" />追加</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">コマ</TableHead>
                  <TableHead className="w-32">開始時刻</TableHead>
                  <TableHead className="w-32">終了時刻</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.label}</TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        defaultValue={s.start_time}
                        className="w-28"
                        onBlur={(e) => {
                          if (e.target.value !== s.start_time) handleUpdate(s, { start_time: e.target.value })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        defaultValue={s.end_time}
                        className="w-28"
                        onBlur={(e) => {
                          if (e.target.value !== s.end_time) handleUpdate(s, { end_time: e.target.value })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(s.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="時間枠を削除"
        description="この時間枠を削除しますか？関連する開講パターンも削除されます。"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
      />
    </div>
  )
}

// ─── 開講パターンタブ ───────────────────────────

const DAY_TYPES = [
  { value: 'weekday', label: '平日' },
  { value: 'saturday', label: '土曜' },
  { value: 'sunday', label: '日曜' },
  { value: 'intensive', label: '講習期間' },
] as const

const AVAILABILITY_OPTIONS = [
  { value: 'open', label: '○ 開講' },
  { value: 'closed', label: '× 非開講' },
  { value: 'priority', label: '△ 優先' },
] as const

function AvailabilityTab() {
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [matrix, setMatrix] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    const [slotsRes, availRes] = await Promise.all([
      fetch('/api/master/time-slots'),
      fetch('/api/master/slot-availability'),
    ])
    const slotsJson = await slotsRes.json()
    const availJson = await availRes.json()

    const timeSlots: TimeSlot[] = slotsJson.data || []
    const avail: SlotAvailability[] = availJson.data || []

    setSlots(timeSlots)

    // Build matrix: { time_slot_id: { day_type: availability } }
    const m: Record<string, Record<string, string>> = {}
    for (const ts of timeSlots) {
      m[ts.id] = {}
      for (const dt of DAY_TYPES) {
        m[ts.id][dt.value] = 'closed' // default
      }
    }
    for (const a of avail) {
      if (m[a.time_slot_id]) {
        m[a.time_slot_id][a.day_type] = a.availability
      }
    }
    setMatrix(m)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleCellChange = (timeSlotId: string, dayType: string, value: string) => {
    setMatrix((prev) => ({
      ...prev,
      [timeSlotId]: { ...prev[timeSlotId], [dayType]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const items: { time_slot_id: string; day_type: string; availability: string }[] = []
      for (const [timeSlotId, dayTypes] of Object.entries(matrix)) {
        for (const [dayType, availability] of Object.entries(dayTypes)) {
          items.push({ time_slot_id: timeSlotId, day_type: dayType, availability })
        }
      }
      const res = await fetch('/api/master/slot-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error()
      toast.success('保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            ○ 開講 / × 非開講 / △ 通常授業優先（空きがあれば講習可）
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">コマ</TableHead>
                  {DAY_TYPES.map((dt) => (
                    <TableHead key={dt.value} className="w-32 text-center">{dt.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell className="font-medium">
                      {slot.label}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({slot.start_time.slice(0, 5)})
                      </span>
                    </TableCell>
                    {DAY_TYPES.map((dt) => (
                      <TableCell key={dt.value} className="text-center">
                        <Select
                          value={matrix[slot.id]?.[dt.value] || 'closed'}
                          onValueChange={(v) => handleCellChange(slot.id, dt.value, v)}
                        >
                          <SelectTrigger className="w-28 mx-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABILITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── ブースタブ ───────────────────────────

function BoothsTab() {
  const [booths, setBooths] = useState<Booth[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [newBooth, setNewBooth] = useState({ booth_number: '', label: '' })

  const fetchBooths = async () => {
    const res = await fetch('/api/master/booths')
    const json = await res.json()
    setBooths(json.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchBooths() }, [])

  const handleAdd = async () => {
    if (!newBooth.booth_number || !newBooth.label) return
    try {
      const maxOrder = booths.reduce((max, b) => Math.max(max, b.sort_order), 0)
      await fetch('/api/master/booths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booth_number: parseInt(newBooth.booth_number),
          label: newBooth.label,
          sort_order: maxOrder + 1,
        }),
      })
      setNewBooth({ booth_number: '', label: '' })
      toast.success('追加しました')
      fetchBooths()
    } catch { toast.error('追加に失敗しました') }
  }

  const handleUpdate = async (booth: Booth, updates: Partial<Booth>) => {
    try {
      await fetch(`/api/master/booths/${booth.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...booth, ...updates }),
      })
      toast.success('更新しました')
      fetchBooths()
    } catch { toast.error('更新に失敗しました') }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/master/booths/${id}`, { method: 'DELETE' })
      toast.success('削除しました')
      fetchBooths()
    } catch { toast.error('削除に失敗しました') }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input
              type="number"
              value={newBooth.booth_number}
              onChange={(e) => setNewBooth({ ...newBooth, booth_number: e.target.value })}
              placeholder="ブース番号"
              className="w-28"
            />
            <Input
              value={newBooth.label}
              onChange={(e) => setNewBooth({ ...newBooth, label: e.target.value })}
              placeholder="ラベル（例: ブース16）"
              className="flex-1"
            />
            <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1" />追加</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">番号</TableHead>
                  <TableHead>ラベル</TableHead>
                  <TableHead className="w-24">有効</TableHead>
                  <TableHead className="w-20">順序</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {booths.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Input
                        type="number"
                        defaultValue={b.booth_number}
                        className="w-20"
                        onBlur={(e) => {
                          const v = parseInt(e.target.value)
                          if (v !== b.booth_number) handleUpdate(b, { booth_number: v })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={b.label}
                        onBlur={(e) => {
                          if (e.target.value !== b.label) handleUpdate(b, { label: e.target.value })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={b.is_active}
                        onCheckedChange={(checked) => handleUpdate(b, { is_active: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        defaultValue={b.sort_order}
                        className="w-16"
                        onBlur={(e) => {
                          const v = parseInt(e.target.value)
                          if (v !== b.sort_order) handleUpdate(b, { sort_order: v })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(b.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="ブースを削除"
        description="このブースを削除しますか？"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
      />
    </div>
  )
}

// ─── 講師シフトタブ ───────────────────────────

const SHIFT_DAYS = ['日', '月', '火', '水', '木', '金', '土'] as const
const SHIFT_DAY_INDICES = [1, 2, 3, 4, 5, 6, 0] // 月〜日

interface TeacherOption {
  id: string
  display_name: string
}

interface ShiftRecord {
  id: string
  teacher_id: string
  time_slot_id: string
  shift_type: string
  day_of_week: number | null
  specific_date: string | null
  is_available: boolean
  teacher: TeacherOption
  time_slot: TimeSlot
}

function InstructorShiftsTab() {
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [shifts, setShifts] = useState<ShiftRecord[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchMasters = useCallback(async () => {
    const [teachersRes, slotsRes] = await Promise.all([
      fetch('/api/teachers'),
      fetch('/api/master/time-slots'),
    ])
    const [teachersJson, slotsJson] = await Promise.all([
      teachersRes.json(), slotsRes.json(),
    ])
    setTeachers(teachersJson.data || [])
    setTimeSlots(slotsJson.data || [])
    setLoading(false)
  }, [])

  const fetchShifts = useCallback(async () => {
    if (!selectedTeacher) { setShifts([]); return }
    const res = await fetch(`/api/instructor-shifts?teacher_id=${selectedTeacher}`)
    const json = await res.json()
    setShifts((json.data || []).filter((s: ShiftRecord) => s.shift_type === 'regular'))
  }, [selectedTeacher])

  useEffect(() => { fetchMasters() }, [fetchMasters])
  useEffect(() => { fetchShifts() }, [fetchShifts])

  // マトリクス: shiftMap[day_of_week][time_slot_id] = ShiftRecord | null
  const shiftMap: Record<number, Record<string, ShiftRecord | null>> = {}
  for (const d of SHIFT_DAY_INDICES) {
    shiftMap[d] = {}
    for (const s of timeSlots) {
      shiftMap[d][s.id] = null
    }
  }
  for (const s of shifts) {
    if (s.day_of_week !== null && shiftMap[s.day_of_week]) {
      shiftMap[s.day_of_week][s.time_slot_id] = s
    }
  }

  const toggleShift = async (dayOfWeek: number, timeSlotId: string) => {
    if (!selectedTeacher) return
    setSaving(true)
    const existing = shiftMap[dayOfWeek]?.[timeSlotId]
    try {
      if (existing) {
        // 削除
        await fetch(`/api/instructor-shifts/${existing.id}`, { method: 'DELETE' })
      } else {
        // 作成
        const res = await fetch('/api/instructor-shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_id: selectedTeacher,
            time_slot_id: timeSlotId,
            shift_type: 'regular',
            day_of_week: dayOfWeek,
            is_available: true,
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error || '登録に失敗しました')
          setSaving(false)
          return
        }
      }
      fetchShifts()
    } catch {
      toast.error('操作に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium whitespace-nowrap">講師を選択:</span>
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="講師を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTeacher && (
            <>
              <p className="text-sm text-muted-foreground">
                セルをクリックしてシフトのON/OFFを切り替えます
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">コマ</TableHead>
                      {SHIFT_DAY_INDICES.map((d) => (
                        <TableHead key={d} className="w-20 text-center">{SHIFT_DAYS[d]}曜</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeSlots.map((slot) => (
                      <TableRow key={slot.id}>
                        <TableCell className="font-medium">
                          {slot.label}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({slot.start_time.slice(0, 5)})
                          </span>
                        </TableCell>
                        {SHIFT_DAY_INDICES.map((d) => {
                          const shift = shiftMap[d]?.[slot.id]
                          return (
                            <TableCell
                              key={d}
                              className={`text-center cursor-pointer transition-colors ${
                                shift ? 'bg-green-100 hover:bg-green-200' : 'hover:bg-muted'
                              } ${saving ? 'pointer-events-none opacity-50' : ''}`}
                              onClick={() => toggleShift(d, slot.id)}
                            >
                              {shift && (
                                <Badge variant="default" className="bg-green-600 text-[11px]">
                                  ○
                                </Badge>
                              )}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

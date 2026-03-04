'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { CalendarOff, Plus, Trash2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CsvImportDialog } from '@/components/csv-import-dialog'
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
  is_active: boolean
  sort_order: number
}

// ─── Main Page ───────────────────────────

export default function LessonMasterPage() {
  const [seeding, setSeeding] = useState(false)

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/master/seed', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || '初期設定に失敗しました')
        return
      }
      toast.success(json.message)
      window.location.reload()
    } catch {
      toast.error('初期設定に失敗しました')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">授業の基本設定</h2>
        <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
          {seeding ? '実行中...' : '初期設定を実行'}
        </Button>
      </div>
      <Tabs defaultValue="time-slots">
        <TabsList>
          <TabsTrigger value="time-slots">時間枠</TabsTrigger>
          <TabsTrigger value="booths">ブース</TabsTrigger>
          <TabsTrigger value="closed-days">休館日</TabsTrigger>
        </TabsList>
        <TabsContent value="time-slots"><TimeSlotsTab /></TabsContent>
        <TabsContent value="booths"><BoothsTab /></TabsContent>
        <TabsContent value="closed-days"><ClosedDaysTab /></TabsContent>
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
        description="この時間枠を削除しますか？"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
      />
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
              placeholder="表示名（例: ブース16）"
              className="flex-1"
            />
            <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1" />追加</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">番号</TableHead>
                  <TableHead>表示名</TableHead>
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

// ─── 休館日タブ ───────────────────────────

interface ClosedDay {
  id: string
  closed_date: string
  reason: string
  created_at: string
}

function ClosedDaysTab() {
  const [closedDays, setClosedDays] = useState<ClosedDay[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [newReason, setNewReason] = useState('')
  const [excludeSat, setExcludeSat] = useState(false)
  const [excludeSun, setExcludeSun] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ClosedDay | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchClosedDays = async () => {
    const res = await fetch('/api/closed-days')
    const json = await res.json()
    setClosedDays(json.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchClosedDays() }, [])

  // 期間から日付配列を生成（曜日除外対応）
  const buildDateList = (start: string, end: string): string[] => {
    const s = new Date(start + 'T00:00:00')
    const e = end ? new Date(end + 'T00:00:00') : s
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return [start]

    const dates: string[] = []
    const current = new Date(s)
    while (current <= e) {
      const dow = current.getDay()
      const skip = (excludeSat && dow === 6) || (excludeSun && dow === 0)
      if (!skip) {
        const y = current.getFullYear()
        const m = String(current.getMonth() + 1).padStart(2, '0')
        const d = String(current.getDate()).padStart(2, '0')
        dates.push(`${y}-${m}-${d}`)
      }
      current.setDate(current.getDate() + 1)
    }
    return dates
  }

  const handleAdd = async () => {
    if (!startDate) { toast.error('開始日を入力してください'); return }
    setSaving(true)
    try {
      const dates = buildDateList(startDate, endDate)
      const isBulk = dates.length > 1

      const res = await fetch('/api/closed-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isBulk
            ? { closed_dates: dates, reason: newReason }
            : { closed_date: dates[0], reason: newReason }
        ),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '追加に失敗しました')

      if (isBulk) {
        const insertedCount = json.data?.length || 0
        const parts: string[] = [`${insertedCount}件の休館日を追加しました`]
        if (json.skippedCount > 0) parts.push(`${json.skippedCount}件は既存のためスキップ`)
        if (json.cancelledCount > 0) parts.push(`${json.cancelledCount}件の授業をキャンセル`)
        toast.success(parts.join('（') + (parts.length > 1 ? '）' : ''))
      } else {
        const msg = json.cancelledCount > 0
          ? `休館日を追加しました（${json.cancelledCount}件の授業を自動キャンセルしました）`
          : '休館日を追加しました'
        toast.success(msg)
      }
      setStartDate('')
      setEndDate('')
      setNewReason('')
      fetchClosedDays()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '追加に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cd: ClosedDay) => {
    try {
      const res = await fetch(`/api/closed-days/${cd.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '削除に失敗しました')
      const msg = json.generatedCount > 0
        ? `休館日を削除しました（${json.generatedCount}件の授業を再生成しました）`
        : '休館日を削除しました'
      toast.success(msg)
      fetchClosedDays()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '削除に失敗しました')
    }
  }

  // プレビュー件数
  const previewCount = startDate
    ? buildDateList(startDate, endDate).length
    : 0

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CalendarOff className="h-4 w-4" />
            休館日に設定すると、その日の授業は自動的にキャンセルされます
          </p>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="space-y-1">
              <label className="text-sm font-medium">開始日</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">終了日（任意）</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-44"
                min={startDate}
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">理由（任意）</label>
              <Input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="例: お盆休み、年末年始"
              />
            </div>
            <Button onClick={handleAdd} disabled={saving}>
              <Plus className="h-4 w-4 mr-1" />{saving ? '追加中...' : '追加'}
              {previewCount > 1 && ` (${previewCount}日)`}
            </Button>
            <CsvImportDialog
              title="休館日CSVインポート"
              description={"1行目：ヘッダー「日付」\n2行目以降：日付を1行ずつ入力（例: 2026/4/29）\n\n※ 既に登録済みの日付は自動でスキップされます\n※ 登録された日の予定済み授業は自動キャンセルされます"}
              sampleCsv={"日付\n2026/04/29\n2026/05/03\n2026/05/04\n2026/05/05\n2026/05/06"}
              apiEndpoint="/api/closed-days/import"
              onSuccess={() => fetchClosedDays()}
            />
          </div>
          {endDate && (
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={excludeSat}
                  onChange={(e) => setExcludeSat(e.target.checked)}
                  className="rounded border-gray-300"
                />
                土曜を除外
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={excludeSun}
                  onChange={(e) => setExcludeSun(e.target.checked)}
                  className="rounded border-gray-300"
                />
                日曜を除外
              </label>
              {previewCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  → {previewCount}日間を一括追加
                </span>
              )}
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">日付</TableHead>
                  <TableHead>理由</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedDays.map((cd) => (
                  <TableRow key={cd.id}>
                    <TableCell className="font-medium">{cd.closed_date}</TableCell>
                    <TableCell className="text-muted-foreground">{cd.reason || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(cd)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {closedDays.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      休館日は設定されていません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="休館日を削除"
        description={`${deleteTarget?.closed_date} の休館日を削除しますか？この日の授業がテンプレートから再生成されます。`}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
      />
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, Search, Send, ChevronDown, ChevronUp, Mail, Check } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

// ─── Types ───────────────────────────

interface OverviewRow {
  student_id: string
  student_name: string
  student_status: string
  record_count: number
  last_mendan_date: string | null
  next_due_date: string | null
  records: {
    id: string
    mendan_date: string
    attendees: string | null
    content: string | null
  }[]
}

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

function formatDate(iso: string) {
  try {
    return format(new Date(iso), 'M/d', { locale: ja })
  } catch {
    return iso
  }
}

// ─── Main Page ───────────────────────────

export default function MendanPage() {
  const [tab, setTab] = useState('overview')

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">面談管理</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">面談一覧</TabsTrigger>
          <TabsTrigger value="requests">面談希望申請</TabsTrigger>
          <TabsTrigger value="email">メール送信</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="requests"><RequestsTab /></TabsContent>
        <TabsContent value="email"><EmailTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Tab 1: 面談一覧（生徒中心ビュー） ───────────────────────────

function OverviewTab() {
  const [rows, setRows] = useState<OverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [over90Only, setOver90Only] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Record dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<{ id: string; student_id: string } | null>(null)
  const [formStudentId, setFormStudentId] = useState('')
  const [formStudentName, setFormStudentName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formAttendees, setFormAttendees] = useState('')
  const [formContent, setFormContent] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/mendan/overview?status=${statusFilter}`)
      const json = await res.json()
      setRows(json.data || [])
    } catch {
      toast.error('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filter
  const now = new Date()
  const filtered = rows.filter(r => {
    if (searchQuery && !r.student_name.includes(searchQuery)) return false
    if (over90Only) {
      if (!r.last_mendan_date) return true // 記録なし = 対象
      const diff = now.getTime() - new Date(r.last_mendan_date).getTime()
      if (diff < 90 * 24 * 60 * 60 * 1000) return false
    }
    return true
  })

  // Record form handlers
  const resetForm = () => {
    setEditingRecord(null)
    setFormStudentId('')
    setFormStudentName('')
    setFormDate('')
    setFormAttendees('')
    setFormContent('')
  }

  const openNewRecord = (studentId: string, studentName: string) => {
    resetForm()
    setFormStudentId(studentId)
    setFormStudentName(studentName)
    setFormDate(new Date().toISOString().split('T')[0])
    setDialogOpen(true)
  }

  const openEditRecord = (record: OverviewRow['records'][0], studentId: string, studentName: string) => {
    resetForm()
    setEditingRecord({ id: record.id, student_id: studentId })
    setFormStudentId(studentId)
    setFormStudentName(studentName)
    setFormDate(record.mendan_date)
    setFormAttendees(record.attendees || '')
    setFormContent(record.content || '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formStudentId || !formDate) {
      toast.error('面談日は必須です')
      return
    }
    if (saving) return
    setSaving(true)

    try {
      const url = editingRecord ? `/api/mendan/records/${editingRecord.id}` : '/api/mendan/records'
      const method = editingRecord ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: formStudentId,
          mendan_date: formDate,
          attendees: formAttendees,
          content: formContent,
        }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      toast.success(editingRecord ? '更新しました' : '登録しました')
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/mendan/records/${id}`, { method: 'DELETE' })
      toast.success('削除しました')
      fetchData()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4 mt-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="生徒名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">通塾生</SelectItem>
            <SelectItem value="inactive">退塾済</SelectItem>
            <SelectItem value="all">全て</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="over90"
            checked={over90Only}
            onCheckedChange={(checked) => setOver90Only(checked === true)}
          />
          <Label htmlFor="over90" className="text-sm cursor-pointer">90日以上経過</Label>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>生徒名</TableHead>
                <TableHead className="text-center">面談回数</TableHead>
                <TableHead>最終面談日</TableHead>
                <TableHead>経過日数</TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    該当する生徒はいません
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(row => (
                  <StudentRow
                    key={row.student_id}
                    row={row}
                    expanded={expandedIds.has(row.student_id)}
                    onToggle={() => toggleExpand(row.student_id)}
                    onNewRecord={() => openNewRecord(row.student_id, row.student_name)}
                    onEditRecord={(rec) => openEditRecord(rec, row.student_id, row.student_name)}
                    onDeleteRecord={(id) => setDeleteTarget(id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Record Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? '面談記録を編集' : '面談記録を作成'}
              {formStudentName && ` - ${formStudentName}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label>面談日 *</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-2 flex-1">
                <Label>出席者</Label>
                <Input value={formAttendees} onChange={(e) => setFormAttendees(e.target.value)} placeholder="例：母親、担任" />
              </div>
            </div>
            <div className="space-y-2 flex-1 flex flex-col">
              <Label>内容</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={12}
                placeholder="面談内容を入力..."
                className="flex-1 min-h-[200px] resize-y text-sm leading-relaxed"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : editingRecord ? '更新' : '登録'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="面談記録を削除"
        description="この面談記録を削除しますか？"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
      />
    </div>
  )
}

// ─── Student Row (with expand) ───────────────────────────

function StudentRow({
  row,
  expanded,
  onToggle,
  onNewRecord,
  onEditRecord,
  onDeleteRecord,
}: {
  row: OverviewRow
  expanded: boolean
  onToggle: () => void
  onNewRecord: () => void
  onEditRecord: (rec: OverviewRow['records'][0]) => void
  onDeleteRecord: (id: string) => void
}) {
  const now = new Date()
  let elapsedDays: number | null = null
  if (row.last_mendan_date) {
    elapsedDays = Math.floor((now.getTime() - new Date(row.last_mendan_date).getTime()) / (1000 * 60 * 60 * 24))
  }

  return (
    <>
      <TableRow className="group">
        <TableCell>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{row.student_name}</TableCell>
        <TableCell className="text-center">{row.record_count}回</TableCell>
        <TableCell className="whitespace-nowrap">
          {row.last_mendan_date ? formatDate(row.last_mendan_date) : '-'}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {elapsedDays !== null ? (
            <span className={elapsedDays >= 90 ? 'text-red-600 font-medium' : ''}>
              {elapsedDays}日
            </span>
          ) : (
            <span className="text-muted-foreground">記録なし</span>
          )}
        </TableCell>
        <TableCell>
          <Button size="sm" variant="outline" onClick={onNewRecord}>
            <Plus className="h-3 w-3 mr-1" />記録
          </Button>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-0">
            <div className="p-4 space-y-4">
              {/* 面談履歴 */}
              <div>
                <h4 className="text-sm font-semibold mb-2">面談履歴</h4>
                {row.records.length === 0 ? (
                  <p className="text-sm text-muted-foreground">面談記録はありません</p>
                ) : (
                  <div className="space-y-2">
                    {row.records.map((rec, idx) => (
                      <div key={rec.id} className="flex items-start justify-between bg-white rounded-lg border p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">第{idx + 1}回</span>
                            <span className="text-sm font-medium">
                              {format(new Date(rec.mendan_date), 'yyyy/M/d', { locale: ja })}
                            </span>
                            {rec.attendees && (
                              <span className="text-xs text-muted-foreground">({rec.attendees})</span>
                            )}
                          </div>
                          {rec.content && (
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{rec.content}</p>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditRecord(rec)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteRecord(rec.id)}>
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─── Tab 2: 面談希望申請 ───────────────────────────

function RequestsTab() {
  const [requests, setRequests] = useState<MendanRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [handledFilter, setHandledFilter] = useState<'all' | 'unhandled' | 'handled'>('unhandled')

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
    // Optimistic update
    setRequests(prev => prev.map(r => r.id === id ? { ...r, handled: !currentHandled } : r))
    try {
      const res = await fetch('/api/mendan/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, handled: !currentHandled }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Revert
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
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="生徒名・期間で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={handledFilter} onValueChange={(v) => setHandledFilter(v as 'all' | 'unhandled' | 'handled')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unhandled">未対応</SelectItem>
            <SelectItem value="handled">対応済</SelectItem>
            <SelectItem value="all">すべて</SelectItem>
          </SelectContent>
        </Select>
        {unhandledCount > 0 && (
          <Badge variant="destructive">{unhandledCount}件 未対応</Badge>
        )}
      </div>

      {/* Table */}
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
                  <TableRow key={r.id} className={r.handled ? 'opacity-60' : ''}>
                    <TableCell className="text-center">
                      <button
                        onClick={() => toggleHandled(r.id, r.handled)}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors ${
                          r.handled
                            ? 'bg-green-100 border-green-400 text-green-700'
                            : 'bg-white border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-600'
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
                    <TableCell className="max-w-[200px] truncate">{r.message || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.submitted_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tab 3: メール送信（強化版） ───────────────────────────

function EmailTab() {
  const now = new Date()
  const defaultLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`
  const [periodLabel, setPeriodLabel] = useState(defaultLabel)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; skipped: number; errors: string[] } | null>(null)

  // Email config
  const [fromEmail, setFromEmail] = useState('')
  const [defaultBody, setDefaultBody] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [variables, setVariables] = useState<{ key: string; description: string }[]>([])
  const [loadingConfig, setLoadingConfig] = useState(true)

  // Auto-send settings
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [autoDay, setAutoDay] = useState(1)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    // Load email config
    fetch('/api/mendan/email-config')
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setFromEmail(json.data.from_email)
          setDefaultBody(json.data.default_body)
          setCustomBody(json.data.default_body)
          setVariables(json.data.variables || [])
        }
        setLoadingConfig(false)
      })
      .catch(() => setLoadingConfig(false))

    // Load auto-send settings
    fetch('/api/settings')
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setAutoEnabled(json.data.mendan_auto_send_enabled ?? false)
          setAutoDay(json.data.mendan_auto_send_day ?? 1)
        }
        setLoadingSettings(false)
      })
      .catch(() => setLoadingSettings(false))
  }, [])

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mendan_auto_send_enabled: autoEnabled,
          mendan_auto_send_day: autoDay,
        }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      toast.success('自動送信設定を保存しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSend = async () => {
    if (!periodLabel) {
      toast.error('期間ラベルを入力してください')
      return
    }
    if (sending) return
    setSending(true)
    setResult(null)

    try {
      const isCustom = customBody.trim() !== defaultBody.trim()
      const res = await fetch('/api/mendan/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_label: periodLabel,
          ...(isCustom ? { custom_body: customBody } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '送信に失敗しました')
      setResult(json.data)
      toast.success(`${json.data.sent}件のメールを送信しました`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setSending(false)
    }
  }

  const dayOptions = Array.from({ length: 28 }, (_, i) => i + 1)

  return (
    <div className="space-y-4 mt-4">
      {/* 送信元アドレス */}
      {!loadingConfig && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">送信元:</span>
              <span className="text-sm font-medium">{fromEmail}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 自動送信設定 */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">自動送信</p>
              <p className="text-xs text-muted-foreground">毎月指定した日時に面談案内メールを自動送信します</p>
            </div>
            {!loadingSettings && (
              <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
            )}
          </div>

          {autoEnabled && (
            <div className="flex items-end gap-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">毎月</Label>
                <Select value={String(autoDay)} onValueChange={(v) => setAutoDay(Number(v))}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dayOptions.map(d => (
                      <SelectItem key={d} value={String(d)}>{d}日</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? '保存中...' : '保存'}
              </Button>
            </div>
          )}

          {!autoEnabled && !loadingSettings && (
            <Button size="sm" variant="outline" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? '保存中...' : 'OFFで保存'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 手動送信 */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm font-medium">手動送信</p>
          <p className="text-sm text-muted-foreground">
            保護者メールアドレスが登録されている全生徒に面談案内メールを一括送信します。
            同じ期間ラベルで既に送信済みの生徒はスキップされます。
          </p>

          <div className="space-y-2">
            <Label>期間ラベル</Label>
            <Input
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="例：2026年3月"
              className="max-w-xs"
            />
          </div>

          {/* メール本文編集 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>メール本文</Label>
              {customBody.trim() !== defaultBody.trim() && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6"
                  onClick={() => setCustomBody(defaultBody)}
                >
                  デフォルトに戻す
                </Button>
              )}
            </div>
            <Textarea
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              rows={6}
              placeholder="メール本文を入力..."
              className="font-mono text-sm"
            />
            {variables.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="font-medium">利用可能な変数:</p>
                {variables.map(v => (
                  <p key={v.key}>
                    <code className="bg-muted px-1 rounded">{v.key}</code> … {v.description}
                  </p>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4 mr-1" />
            {sending ? '送信中...' : '一括送信'}
          </Button>

          {result && (
            <div className="bg-gray-50 rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium">送信結果</p>
              <div className="text-sm space-y-1">
                <p>送信成功: {result.sent}件</p>
                <p>スキップ（送信済み）: {result.skipped}件</p>
                {result.errors.length > 0 && (
                  <div>
                    <p className="text-red-600">エラー: {result.errors.length}件</p>
                    <ul className="list-disc list-inside text-red-600 text-xs mt-1">
                      {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

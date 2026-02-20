'use client'

import { useEffect, useState } from 'react'
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
import { Plus, Pencil, Trash2, Search, Send } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface MendanRequestRow {
  id: string
  candidate1: string
  candidate2: string
  candidate3: string
  message: string | null
  submitted_at: string
  student: { name: string }
  token: { period_label: string }
}

interface MendanRecordRow {
  id: string
  student_id: string
  mendan_date: string
  attendees: string | null
  content: string | null
  created_at: string
  student: { name: string }
}

interface StudentOption {
  id: string
  name: string
}

function formatDateTime(iso: string) {
  try {
    return format(new Date(iso), 'M/d (E) HH:mm', { locale: ja })
  } catch {
    return iso
  }
}

export default function MendanPage() {
  const [tab, setTab] = useState('requests')

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">面談管理</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="requests">面談申請</TabsTrigger>
          <TabsTrigger value="records">面談記録</TabsTrigger>
          <TabsTrigger value="email">メール送信</TabsTrigger>
        </TabsList>
        <TabsContent value="requests"><RequestsTab /></TabsContent>
        <TabsContent value="records"><RecordsTab /></TabsContent>
        <TabsContent value="email"><EmailTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Tab 1: 面談申請 ───────────────────────────
function RequestsTab() {
  const [requests, setRequests] = useState<MendanRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetch('/api/mendan/requests')
      .then(res => res.json())
      .then(json => { setRequests(json.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  const filtered = requests.filter(r =>
    !searchQuery ||
    r.student.name.includes(searchQuery) ||
    r.token.period_label.includes(searchQuery)
  )

  return (
    <div className="space-y-4 mt-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="生徒名・期間で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    面談申請はありません
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.student.name}</TableCell>
                    <TableCell>{r.token.period_label}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.candidate1)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.candidate2)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.candidate3)}</TableCell>
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

// ─── Tab 2: 面談記録 ───────────────────────────
function RecordsTab() {
  const [records, setRecords] = useState<MendanRecordRow[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MendanRecordRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form
  const [studentId, setStudentId] = useState('')
  const [mendanDate, setMendanDate] = useState('')
  const [attendees, setAttendees] = useState('')
  const [content, setContent] = useState('')

  const fetchData = async () => {
    const [recRes, stuRes] = await Promise.all([
      fetch('/api/mendan/records'),
      fetch('/api/students'),
    ])
    const [recJson, stuJson] = await Promise.all([recRes.json(), stuRes.json()])
    setRecords(recJson.data || [])
    setStudents((stuJson.data || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const resetForm = () => {
    setStudentId('')
    setMendanDate('')
    setAttendees('')
    setContent('')
    setEditing(null)
  }

  const openEdit = (r: MendanRecordRow) => {
    setEditing(r)
    setStudentId(r.student_id)
    setMendanDate(r.mendan_date)
    setAttendees(r.attendees || '')
    setContent(r.content || '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!studentId || !mendanDate) {
      toast.error('生徒と面談日は必須です')
      return
    }
    if (saving) return
    setSaving(true)

    try {
      const url = editing ? `/api/mendan/records/${editing.id}` : '/api/mendan/records'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, mendan_date: mendanDate, attendees, content }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      toast.success(editing ? '更新しました' : '登録しました')
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

  const filtered = records.filter(r =>
    !searchQuery || r.student.name.includes(searchQuery)
  )

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 mr-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="生徒名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" />新規作成
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>生徒名</TableHead>
                <TableHead>面談日</TableHead>
                <TableHead>出席者</TableHead>
                <TableHead>内容</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    面談記録はありません
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.student.name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(r.mendan_date), 'yyyy/M/d', { locale: ja })}
                    </TableCell>
                    <TableCell>{r.attendees || '-'}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{r.content || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" aria-label="編集" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(r.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '面談記録を編集' : '面談記録を作成'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>生徒 *</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="生徒を選択" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>面談日 *</Label>
              <Input type="date" value={mendanDate} onChange={(e) => setMendanDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>出席者</Label>
              <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="例：母親、担任" />
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="面談内容を入力" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : editing ? '更新' : '登録'}</Button>
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

// ─── Tab 3: メール送信 ───────────────────────────
function EmailTab() {
  const now = new Date()
  const defaultLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`
  const [periodLabel, setPeriodLabel] = useState(defaultLabel)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; skipped: number; errors: string[] } | null>(null)

  // 自動送信設定
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [autoDay, setAutoDay] = useState(1)
  const [autoHour, setAutoHour] = useState(9)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setAutoEnabled(json.data.mendan_auto_send_enabled ?? false)
          setAutoDay(json.data.mendan_auto_send_day ?? 1)
          setAutoHour(json.data.mendan_auto_send_hour ?? 9)
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
          mendan_auto_send_hour: autoHour,
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
      const res = await fetch('/api/mendan/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_label: periodLabel }),
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
  const hourOptions = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="space-y-4 mt-4">
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
              <div className="space-y-1">
                <Label className="text-xs">時刻 (JST)</Label>
                <Select value={String(autoHour)} onValueChange={(v) => setAutoHour(Number(v))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {hourOptions.map(h => (
                      <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
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

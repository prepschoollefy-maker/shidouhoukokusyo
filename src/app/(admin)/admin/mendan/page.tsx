'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp, Link2, Copy } from 'lucide-react'
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
  records: {
    id: string
    mendan_date: string
    attendees: string | null
    content: string | null
  }[]
}

function formatDate(iso: string) {
  try {
    return format(new Date(iso), 'M/d', { locale: ja })
  } catch {
    return iso
  }
}

// ─── Main Page ───────────────────────────

export default function MendanOverviewPage() {
  const [rows, setRows] = useState<OverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [over90Only, setOver90Only] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Record dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<{ id: string; student_id: string } | null>(null)
  const [formStudentId, setFormStudentId] = useState('')
  const [formStudentName, setFormStudentName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formAttendees, setFormAttendees] = useState('')
  const [formContent, setFormContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkStudentId, setLinkStudentId] = useState('')
  const [linkStudentName, setLinkStudentName] = useState('')
  const [linkPeriod, setLinkPeriod] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [generating, setGenerating] = useState(false)

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

  const now = new Date()
  const filtered = rows.filter(r => {
    if (searchQuery && !r.student_name.includes(searchQuery)) return false
    if (over90Only) {
      if (!r.last_mendan_date) return true
      const diff = now.getTime() - new Date(r.last_mendan_date).getTime()
      if (diff < 90 * 24 * 60 * 60 * 1000) return false
    }
    return true
  })

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
        body: JSON.stringify({ student_id: formStudentId, mendan_date: formDate, attendees: formAttendees, content: formContent }),
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

  const openLinkDialog = (studentId: string, studentName: string) => {
    const defaultLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`
    setLinkStudentId(studentId)
    setLinkStudentName(studentName)
    setLinkPeriod(defaultLabel)
    setGeneratedUrl('')
    setLinkDialogOpen(true)
  }

  const handleGenerateLink = async () => {
    if (!linkPeriod) {
      toast.error('期間ラベルを入力してください')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/mendan/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: linkStudentId, period_label: linkPeriod }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'リンク生成に失敗しました')
      setGeneratedUrl(json.data.url)
      if (json.data.existing) {
        toast.info('既存のリンクを取得しました')
      } else {
        toast.success('リンクを発行しました')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl)
      toast.success('コピーしました')
    } catch {
      toast.error('コピーに失敗しました')
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">面談一覧</h2>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="生徒名で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">通塾生</SelectItem>
            <SelectItem value="inactive">退塾済</SelectItem>
            <SelectItem value="all">全て</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox id="over90" checked={over90Only} onCheckedChange={(checked) => setOver90Only(checked === true)} />
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
                <TableHead className="w-32">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">該当する生徒はいません</TableCell>
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
                    onGenerateLink={() => openLinkDialog(row.student_id, row.student_name)}
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
              <Textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={12} placeholder="面談内容を入力..." className="flex-1 min-h-[200px] resize-y text-sm leading-relaxed" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : editingRecord ? '更新' : '登録'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>リンク発行 - {linkStudentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>期間ラベル</Label>
              <Input value={linkPeriod} onChange={(e) => setLinkPeriod(e.target.value)} placeholder="例：2026年3月" />
            </div>
            {!generatedUrl && (
              <Button onClick={handleGenerateLink} disabled={generating} className="w-full">
                <Link2 className="h-4 w-4 mr-1" />
                {generating ? '生成中...' : 'リンクを発行'}
              </Button>
            )}
            {generatedUrl && (
              <div className="space-y-2">
                <Label>面談希望日入力リンク</Label>
                <div className="flex gap-2">
                  <Input value={generatedUrl} readOnly className="text-xs" />
                  <Button variant="outline" size="icon" onClick={copyToClipboard} title="コピー">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">このリンクを保護者にお送りください（有効期限: 14日間）</p>
              </div>
            )}
          </div>
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

// ─── Student Row ───────────────────────────

function StudentRow({
  row, expanded, onToggle, onNewRecord, onEditRecord, onDeleteRecord, onGenerateLink,
}: {
  row: OverviewRow
  expanded: boolean
  onToggle: () => void
  onNewRecord: () => void
  onEditRecord: (rec: OverviewRow['records'][0]) => void
  onDeleteRecord: (id: string) => void
  onGenerateLink: () => void
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
        <TableCell className="whitespace-nowrap">{row.last_mendan_date ? formatDate(row.last_mendan_date) : '-'}</TableCell>
        <TableCell className="whitespace-nowrap">
          {elapsedDays !== null ? (
            <span className={elapsedDays >= 90 ? 'text-red-600 font-medium' : ''}>{elapsedDays}日</span>
          ) : (
            <span className="text-muted-foreground">記録なし</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={onNewRecord}>
              <Plus className="h-3 w-3 mr-1" />記録
            </Button>
            <Button size="sm" variant="ghost" onClick={onGenerateLink} title="リンク発行">
              <Link2 className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-0">
            <div className="p-4">
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
                          <span className="text-sm font-medium">{format(new Date(rec.mendan_date), 'yyyy/M/d', { locale: ja })}</span>
                          {rec.attendees && <span className="text-xs text-muted-foreground">({rec.attendees})</span>}
                        </div>
                        {rec.content && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{rec.content}</p>}
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditRecord(rec)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteRecord(rec.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

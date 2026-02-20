'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, Download, Search, RotateCcw, UserMinus } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { CsvImportDialog } from '@/components/csv-import-dialog'

interface Student {
  id: string
  name: string
  grade: string | null
  send_mode: string
  weekly_lesson_count: number | null
  status: 'active' | 'withdrawn'
  parent_emails: { id: string; email: string; label: string | null }[]
  student_subjects: { subject: { id: string; name: string } }[]
  teacher_student_assignments: { teacher_id: string; teacher: { id: string; display_name: string } }[]
}

interface Subject { id: string; name: string }
interface Teacher { id: string; display_name: string; email: string }

const gradeOptions = [
  '小3', '小4', '小5', '小6',
  '中1', '中2', '中3',
  '高1', '高2', '高3',
  '浪人',
]

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<Student | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Student | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'withdrawn'>('active')

  // Form state
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [weeklyCount, setWeeklyCount] = useState('')
  const [emails, setEmails] = useState<{ email: string; label: string }[]>([{ email: '', label: '' }])
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([])

  const fetchData = async () => {
    const [studentsRes, subjectsRes, teachersRes] = await Promise.all([
      fetch(`/api/students?status=${statusFilter}`),
      fetch('/api/master/subjects'),
      fetch('/api/teachers'),
    ])
    const [sj, subj, tj] = await Promise.all([studentsRes.json(), subjectsRes.json(), teachersRes.json()])
    setStudents(sj.data || [])
    setSubjects(subj.data || [])
    setTeachers(tj.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [statusFilter])

  const resetForm = () => {
    setName(''); setGrade('')
    setWeeklyCount(''); setEmails([{ email: '', label: '' }])
    setSelectedSubjects([]); setSelectedTeachers([]); setEditing(null)
  }

  const openEdit = (s: Student) => {
    setEditing(s)
    setName(s.name)
    setGrade(s.grade || '')
    setWeeklyCount(s.weekly_lesson_count ? String(s.weekly_lesson_count) : '')
    setEmails(s.parent_emails.length ? s.parent_emails.map(e => ({ email: e.email, label: e.label || '' })) : [{ email: '', label: '' }])
    setSelectedSubjects(s.student_subjects.map(ss => ss.subject.id))
    setSelectedTeachers([...new Set(s.teacher_student_assignments.map(ta => ta.teacher_id))])
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name) { toast.error('生徒名を入力してください'); return }
    if (saving) return
    setSaving(true)
    const payload = {
      name,
      grade: grade || null,
      weekly_lesson_count: weeklyCount ? parseInt(weeklyCount) : null,
      parent_emails: emails.filter(e => e.email).map(e => ({ email: e.email, label: e.label || null })),
      subject_ids: selectedSubjects,
      teacher_assignments: selectedTeachers.map(tid => ({ teacher_id: tid })),
    }

    try {
      const url = editing ? `/api/students/${editing.id}` : '/api/students'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
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

  const handleWithdraw = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'withdrawn' }),
      })
      if (!res.ok) throw new Error('退塾処理に失敗しました')
      toast.success('退塾処理を行いました')
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '退塾処理に失敗しました')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })
      if (!res.ok) throw new Error('復帰処理に失敗しました')
      toast.success('通塾生に復帰しました')
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '復帰処理に失敗しました')
    }
  }

  const handleExport = () => {
    const header = '名前,学年,週当たり通塾回数,メール1,メール2'
    const rows = students.map(s => {
      const emails = s.parent_emails || []
      return [
        s.name,
        s.grade || '',
        s.weekly_lesson_count ?? '',
        emails[0]?.email || '',
        emails[1]?.email || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = '\uFEFF' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '生徒一覧.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('削除しました')
      fetchData()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const handleBulkDelete = async () => {
    try {
      const res = await fetch('/api/students/bulk-delete', { method: 'DELETE' })
      if (!res.ok) throw new Error('一括削除に失敗しました')
      toast.success('全生徒データを削除しました')
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '一括削除に失敗しました')
    }
  }

  if (loading) return <LoadingSpinner />

  const filteredStudents = students.filter(s =>
    !searchQuery || s.name.includes(searchQuery) || s.grade?.includes(searchQuery)
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">生徒管理</h2>
        <div className="flex gap-2">
          {students.length > 0 && (
            <>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />CSVエクスポート
              </Button>
              <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" />一括削除
              </Button>
            </>
          )}
          {statusFilter === 'active' && (
            <>
              <CsvImportDialog
                title="生徒CSVインポート"
                description="CSV形式で生徒を一括登録します。ヘッダー行が必要です。"
                sampleCsv={"名前,学年,週当たり通塾回数,メール1,メール2\n山田太郎,中2,3,father@example.com,mother@example.com\n佐藤花子,高1,2,,mother@example.com"}
                apiEndpoint="/api/students/import"
                onSuccess={fetchData}
              />
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-1" />新規登録</Button>
                </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editing ? '生徒編集' : '生徒登録'}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>氏名 *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>学年</Label>
                    <Select value={grade} onValueChange={setGrade}>
                      <SelectTrigger><SelectValue placeholder="学年を選択" /></SelectTrigger>
                      <SelectContent>
                        {gradeOptions.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>週当たり通塾回数</Label>
                    <Input type="number" value={weeklyCount} onChange={(e) => setWeeklyCount(e.target.value)} placeholder="例：3" min="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>保護者メール</Label>
                    {emails.map((e, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={e.email} onChange={(ev) => { const ne = [...emails]; ne[i].email = ev.target.value; setEmails(ne) }} placeholder="email@example.com" className="flex-1" />
                        <Input value={e.label} onChange={(ev) => { const ne = [...emails]; ne[i].label = ev.target.value; setEmails(ne) }} placeholder="ラベル" className="w-24" />
                        {emails.length > 1 && <Button variant="ghost" size="icon" aria-label="メール削除" onClick={() => setEmails(emails.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setEmails([...emails, { email: '', label: '' }])}>
                      <Plus className="h-4 w-4 mr-1" />追加
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>通塾科目</Label>
                    <div className="flex flex-wrap gap-2">
                      {subjects.map(s => (
                        <Badge key={s.id} variant={selectedSubjects.includes(s.id) ? 'default' : 'outline'} className="cursor-pointer"
                          onClick={() => setSelectedSubjects(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}>
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>担当講師</Label>
                    <div className="flex flex-wrap gap-2">
                      {teachers.map(t => (
                        <Badge key={t.id} variant={selectedTeachers.includes(t.id) ? 'default' : 'outline'} className="cursor-pointer"
                          onClick={() => setSelectedTeachers(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}>
                          {t.display_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>キャンセル</Button>
                  <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : editing ? '更新' : '登録'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <div className="flex rounded-lg border overflow-hidden">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${statusFilter === 'active' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
            onClick={() => { setStatusFilter('active'); setLoading(true) }}
          >
            通塾生
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${statusFilter === 'withdrawn' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
            onClick={() => { setStatusFilter('withdrawn'); setLoading(true) }}
          >
            退塾済
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="生徒名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>氏名</TableHead>
                <TableHead>学年</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>科目</TableHead>
                <TableHead>担当</TableHead>
                <TableHead>週回数</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.grade || '-'}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {s.parent_emails.length > 0
                        ? s.parent_emails.map(pe => (
                            <div key={pe.id}>{pe.email}{pe.label ? ` (${pe.label})` : ''}</div>
                          ))
                        : '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {s.student_subjects.map(ss => (
                        <Badge key={ss.subject.id} variant="secondary" className="text-xs">{ss.subject.name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {[...new Map(s.teacher_student_assignments.map(ta => [ta.teacher_id, ta.teacher.display_name])).values()].map((name, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{s.weekly_lesson_count ? `${s.weekly_lesson_count}回` : '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {statusFilter === 'active' ? (
                        <>
                          <Button variant="ghost" size="icon" aria-label="編集" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" aria-label="退塾" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => setWithdrawTarget(s)}>
                            <UserMinus className="h-4 w-4 mr-1" />退塾
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" aria-label="復帰" onClick={() => setRestoreTarget(s)}>
                            <RotateCcw className="h-4 w-4 mr-1" />復帰
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(s)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {statusFilter === 'active' ? '通塾生がいません' : '退塾済の生徒はいません'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!withdrawTarget}
        onOpenChange={(open) => { if (!open) setWithdrawTarget(null) }}
        title="生徒を退塾処理"
        description={`${withdrawTarget?.name}さんを退塾処理しますか？退塾済タブから復帰させることができます。`}
        onConfirm={() => { if (withdrawTarget) handleWithdraw(withdrawTarget.id); setWithdrawTarget(null) }}
        confirmLabel="退塾する"
      />
      <ConfirmDialog
        open={!!restoreTarget}
        onOpenChange={(open) => { if (!open) setRestoreTarget(null) }}
        title="生徒を復帰"
        description={`${restoreTarget?.name}さんを通塾生に復帰させますか？`}
        onConfirm={() => { if (restoreTarget) handleRestore(restoreTarget.id); setRestoreTarget(null) }}
        confirmLabel="復帰する"
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="生徒データを削除"
        description={`${deleteTarget?.name}さんのデータを完全に削除しますか？この操作は取り消せません。`}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.id); setDeleteTarget(null) }}
        confirmLabel="削除する"
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="全生徒データを一括削除"
        description={`全${students.length}件の生徒データを完全に削除します。この操作は取り消せません。`}
        onConfirm={() => { handleBulkDelete(); setBulkDeleteOpen(false) }}
        confirmLabel="一括削除する"
      />
    </div>
  )
}

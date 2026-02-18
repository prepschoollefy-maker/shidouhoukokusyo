'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CsvImportDialog } from '@/components/csv-import-dialog'

interface Student {
  id: string
  name: string
  grade: string | null
  summary_frequency: number
  send_mode: string
  weekly_lesson_count: number | null
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [summaryFreq, setSummaryFreq] = useState('4')
  const [sendMode, setSendMode] = useState('manual')
  const [weeklyCount, setWeeklyCount] = useState('')
  const [emails, setEmails] = useState<{ email: string; label: string }[]>([{ email: '', label: '' }])
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([])

  const fetchData = async () => {
    const [studentsRes, subjectsRes, teachersRes] = await Promise.all([
      fetch('/api/students'),
      fetch('/api/master/subjects'),
      fetch('/api/teachers'),
    ])
    const [sj, subj, tj] = await Promise.all([studentsRes.json(), subjectsRes.json(), teachersRes.json()])
    setStudents(sj.data || [])
    setSubjects(subj.data || [])
    setTeachers(tj.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const resetForm = () => {
    setName(''); setGrade(''); setSummaryFreq('4'); setSendMode('manual')
    setWeeklyCount(''); setEmails([{ email: '', label: '' }])
    setSelectedSubjects([]); setSelectedTeachers([]); setEditing(null)
  }

  const openEdit = (s: Student) => {
    setEditing(s)
    setName(s.name)
    setGrade(s.grade || '')
    setSummaryFreq(String(s.summary_frequency))
    setSendMode(s.send_mode)
    setWeeklyCount(s.weekly_lesson_count ? String(s.weekly_lesson_count) : '')
    setEmails(s.parent_emails.length ? s.parent_emails.map(e => ({ email: e.email, label: e.label || '' })) : [{ email: '', label: '' }])
    setSelectedSubjects(s.student_subjects.map(ss => ss.subject.id))
    setSelectedTeachers([...new Set(s.teacher_student_assignments.map(ta => ta.teacher_id))])
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name) { toast.error('生徒名を入力してください'); return }
    const payload = {
      name,
      grade: grade || null,
      summary_frequency: parseInt(summaryFreq) || 4,
      send_mode: sendMode,
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
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この生徒を削除しますか？')) return
    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE' })
      toast.success('削除しました')
      fetchData()
    } catch { toast.error('削除に失敗しました') }
  }

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">読み込み中...</p></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">生徒管理</h2>
        <div className="flex gap-2">
          <CsvImportDialog
            title="生徒CSVインポート"
            description="CSV形式で生徒を一括登録します。ヘッダー行が必要です。"
            sampleCsv="名前,学年,科目,保護者メール,週コマ数,まとめ頻度,送信モード\n山田太郎,中2,数学、英語,parent@example.com,3,4,手動\n佐藤花子,高1,数学、物理、化学,father@example.com;mother@example.com,4,4,手動"
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>まとめ頻度</Label>
                  <Input type="number" value={summaryFreq} onChange={(e) => setSummaryFreq(e.target.value)} min="1" />
                </div>
                <div className="space-y-2">
                  <Label>送信モード</Label>
                  <Select value={sendMode} onValueChange={setSendMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">手動承認</SelectItem>
                      <SelectItem value="auto_send">自動送信</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>週コマ数</Label>
                <Input type="number" value={weeklyCount} onChange={(e) => setWeeklyCount(e.target.value)} placeholder="例：3" min="0" />
              </div>
              <div className="space-y-2">
                <Label>保護者メール</Label>
                {emails.map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={e.email} onChange={(ev) => { const ne = [...emails]; ne[i].email = ev.target.value; setEmails(ne) }} placeholder="email@example.com" className="flex-1" />
                    <Input value={e.label} onChange={(ev) => { const ne = [...emails]; ne[i].label = ev.target.value; setEmails(ne) }} placeholder="ラベル" className="w-24" />
                    {emails.length > 1 && <Button variant="ghost" size="icon" onClick={() => setEmails(emails.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
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
              <Button onClick={handleSave}>{editing ? '更新' : '登録'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>氏名</TableHead>
                <TableHead>学年</TableHead>
                <TableHead>科目</TableHead>
                <TableHead>担当</TableHead>
                <TableHead>頻度</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.grade || '-'}</TableCell>
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
                  <TableCell>{s.summary_frequency}回</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

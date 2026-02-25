'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, Search, Lock } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { CsvImportDialog } from '@/components/csv-import-dialog'
import { GRADES, COURSES, CAMPAIGN_OPTIONS } from '@/lib/contracts/pricing'

interface Student {
  id: string
  name: string
  student_number: string | null
}

interface CourseEntry {
  course: string
  lessons: number
}

interface Contract {
  id: string
  student_id: string
  contract_no: string | null
  start_date: string
  end_date: string
  grade: string
  courses: CourseEntry[]
  monthly_amount: number
  notes: string
  campaign: string | null
  student: Student
}

type FilterMode = 'active' | 'all' | 'expired'

export default function ContractsPage() {
  // パスワード認証
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [storedPw, setStoredPw] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [contracts, setContracts] = useState<Contract[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Contract | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('active')

  // Form state
  const [formStudentId, setFormStudentId] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formGrade, setFormGrade] = useState('')
  const [formCourses, setFormCourses] = useState<CourseEntry[]>([{ course: '', lessons: 1 }])
  const [formNotes, setFormNotes] = useState('')
  const [formCampaign, setFormCampaign] = useState('_none')
  const [calcAmount, setCalcAmount] = useState<number | null>(null)

  const handleAuth = async () => {
    if (!password) { toast.error('パスワードを入力してください'); return }
    setVerifying(true)
    try {
      const res = await fetch(`/api/contracts?pw=${encodeURIComponent(password)}`)
      if (res.status === 403) {
        toast.error('パスワードが正しくありません')
        setVerifying(false)
        return
      }
      if (!res.ok) throw new Error('エラーが発生しました')
      const json = await res.json()
      setContracts(json.data || [])
      setStoredPw(password)
      setAuthenticated(true)
      setLoading(false)
    } catch {
      toast.error('認証に失敗しました')
    } finally {
      setVerifying(false)
    }
  }

  const fetchContracts = useCallback(async () => {
    if (!storedPw) return
    const res = await fetch(`/api/contracts?pw=${encodeURIComponent(storedPw)}`)
    const json = await res.json()
    setContracts(json.data || [])
    setLoading(false)
  }, [storedPw])

  const fetchStudents = useCallback(async () => {
    const res = await fetch('/api/students?status=active')
    const json = await res.json()
    setStudents((json.data || []).map((s: Student & Record<string, unknown>) => ({ id: s.id, name: s.name, student_number: s.student_number })))
  }, [])

  useEffect(() => {
    if (!authenticated) return
    fetchContracts(); fetchStudents()
  }, [authenticated, fetchContracts, fetchStudents])

  // 月謝自動計算
  useEffect(() => {
    const validCourses = formCourses.filter(c => c.course && c.lessons > 0)
    if (!formGrade || validCourses.length === 0) { setCalcAmount(null); return }
    const calc = async () => {
      try {
        const res = await fetch('/api/contracts/calc-monthly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grade: formGrade, courses: validCourses }),
        })
        const json = await res.json()
        setCalcAmount(json.monthly_amount ?? null)
      } catch { setCalcAmount(null) }
    }
    calc()
  }, [formGrade, formCourses])

  const resetForm = () => {
    setFormStudentId(''); setFormStartDate(''); setFormEndDate('')
    setFormGrade(''); setFormCourses([{ course: '', lessons: 1 }])
    setFormNotes(''); setFormCampaign('_none'); setCalcAmount(null); setEditing(null)
  }

  const openEdit = (c: Contract) => {
    setEditing(c)
    setFormStudentId(c.student_id)
    setFormStartDate(c.start_date)
    setFormEndDate(c.end_date)
    setFormGrade(c.grade)
    setFormCourses(c.courses.length ? c.courses : [{ course: '', lessons: 1 }])
    setFormNotes(c.notes)
    setFormCampaign(c.campaign || '_none')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formStudentId) { toast.error('生徒を選択してください'); return }
    if (!formStartDate || !formEndDate) { toast.error('契約期間を入力してください'); return }
    if (!formGrade) { toast.error('学年を選択してください'); return }
    const validCourses = formCourses.filter(c => c.course && c.lessons > 0)
    if (validCourses.length === 0) { toast.error('コースを1つ以上設定してください'); return }
    if (saving) return
    setSaving(true)

    const payload = {
      student_id: formStudentId,
      start_date: formStartDate,
      end_date: formEndDate,
      grade: formGrade,
      courses: validCourses,
      notes: formNotes,
      campaign: (formCampaign && formCampaign !== '_none') ? formCampaign : null,
    }

    try {
      const url = editing ? `/api/contracts/${editing.id}` : '/api/contracts'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-dashboard-pw': storedPw },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      toast.success(editing ? '更新しました' : '登録しました')
      setDialogOpen(false)
      resetForm()
      fetchContracts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/contracts/${id}?pw=${encodeURIComponent(storedPw)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('削除しました')
      fetchContracts()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const updateCourse = (index: number, field: keyof CourseEntry, value: string | number) => {
    setFormCourses(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  // パスワード入力画面
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-bold">契約管理</h2>
              <p className="text-sm text-muted-foreground text-center">閲覧にはパスワードが必要です</p>
            </div>
            <div className="space-y-2">
              <Label>パスワード</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAuth() }}
                autoFocus
              />
            </div>
            <Button className="w-full" onClick={handleAuth} disabled={verifying}>
              {verifying ? '確認中...' : 'ログイン'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) return <LoadingSpinner />

  const today = new Date().toISOString().split('T')[0]
  const filteredContracts = contracts.filter(c => {
    if (filterMode === 'active' && c.end_date < today) return false
    if (filterMode === 'expired' && c.end_date >= today) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const name = c.student?.name?.toLowerCase() || ''
      const num = c.student?.student_number?.toLowerCase() || ''
      return name.includes(q) || num.includes(q)
    }
    return true
  })

  const formatYen = (n: number) => `¥${n.toLocaleString()}`
  const formatCourses = (courses: CourseEntry[]) =>
    courses.map(c => `${c.course}(週${c.lessons})`).join(', ')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">契約管理</h2>
        <div className="flex gap-2">
          <CsvImportDialog
            title="契約CSVインポート"
            description={`CSV形式で契約を一括登録します。塾生番号で生徒を紐付けます。\n\n【コース名】ハイ / ハイPLUS / エク / エグゼ\n【キャンペーン】入塾金無料 / 入塾金半額 / 講習キャンペーン（空欄=なし）`}
            sampleCsv={"塾生番号,学年,開始日,終了日,コース1,コマ数1,コース2,コマ数2,キャンペーン,備考\nS001,中2,2026-04-01,2027-03-31,ハイ,2,,,,\nS002,高1,2026-04-01,2027-03-31,エク,1,ハイ,2,入塾金半額,\nS003,中3,2026-04-01,2027-03-31,エグゼ,3,,,講習キャンペーン,"}
            apiEndpoint="/api/contracts/import"
            extraHeaders={{ 'x-dashboard-pw': storedPw }}
            onSuccess={fetchContracts}
          />
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />新規登録</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? '契約編集' : '契約登録'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>生徒 *</Label>
                  <Select value={formStudentId} onValueChange={setFormStudentId}>
                    <SelectTrigger><SelectValue placeholder="生徒を選択" /></SelectTrigger>
                    <SelectContent>
                      {students.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.student_number ? `${s.student_number} ` : ''}{s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>学年 *</Label>
                  <Select value={formGrade} onValueChange={setFormGrade}>
                    <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      {GRADES.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>開始日 *</Label>
                    <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>終了日 *</Label>
                    <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>コース *</Label>
                  {formCourses.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Select value={c.course} onValueChange={(v) => updateCourse(i, 'course', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="コース" /></SelectTrigger>
                        <SelectContent>
                          {COURSES.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">週</span>
                        <Input
                          type="number" min={1} max={7}
                          value={c.lessons}
                          onChange={(e) => updateCourse(i, 'lessons', parseInt(e.target.value) || 1)}
                          className="w-16"
                        />
                        <span className="text-sm text-muted-foreground">コマ</span>
                      </div>
                      {formCourses.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => setFormCourses(prev => prev.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {formCourses.length < 3 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setFormCourses(prev => [...prev, { course: '', lessons: 1 }])}>
                      <Plus className="h-4 w-4 mr-1" />コース追加
                    </Button>
                  )}
                </div>
                {calcAmount !== null && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <span className="text-sm text-muted-foreground">月謝（税込自動計算）:</span>
                    <span className="ml-2 font-bold text-lg">{formatYen(calcAmount)}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>キャンペーン</Label>
                  <Select value={formCampaign} onValueChange={setFormCampaign}>
                    <SelectTrigger><SelectValue placeholder="なし" /></SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_OPTIONS.map(opt => (
                        <SelectItem key={opt.value || '_none'} value={opt.value || '_none'}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>備考</Label>
                  <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>キャンセル</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : editing ? '更新' : '登録'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <div className="flex rounded-lg border overflow-hidden">
          {(['active', 'all', 'expired'] as FilterMode[]).map(mode => (
            <button
              key={mode}
              className={`px-4 py-2 text-sm font-medium transition-colors ${filterMode === mode ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              onClick={() => setFilterMode(mode)}
            >
              {mode === 'active' ? '有効' : mode === 'all' ? '全件' : '期限切れ'}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="生徒名・塾生番号で検索..."
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
                <TableHead>生徒</TableHead>
                <TableHead>学年</TableHead>
                <TableHead>コース</TableHead>
                <TableHead className="text-right">月謝</TableHead>
                <TableHead>契約期間</TableHead>
                <TableHead>キャンペーン</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((c) => (
                <TableRow key={c.id} className={c.end_date < today ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">
                    <div>{c.student?.name}</div>
                    {c.student?.student_number && (
                      <div className="text-xs text-muted-foreground">{c.student.student_number}</div>
                    )}
                  </TableCell>
                  <TableCell>{c.grade}</TableCell>
                  <TableCell className="text-sm">{formatCourses(c.courses)}</TableCell>
                  <TableCell className="text-right font-mono">{formatYen(c.monthly_amount)}</TableCell>
                  <TableCell className="text-sm">
                    {c.start_date} ~ {c.end_date}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.campaign ? <Badge variant="secondary">{c.campaign}</Badge> : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="編集" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(c)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredContracts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    契約データがありません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="契約を削除"
        description={`${deleteTarget?.student?.name}さんの契約を削除しますか？この操作は取り消せません。`}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.id); setDeleteTarget(null) }}
        confirmLabel="削除する"
      />
    </div>
  )
}

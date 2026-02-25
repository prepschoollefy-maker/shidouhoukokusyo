'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Search, Lock } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { GRADES } from '@/lib/contracts/pricing'
import {
  LECTURE_LABELS,
  LECTURE_COURSES,
  calcLectureUnitPrice,
  type LectureCourseEntry,
  type LectureAllocation,
} from '@/lib/lectures/pricing'

interface Student {
  id: string
  name: string
  student_number: string | null
}

interface Lecture {
  id: string
  student_id: string
  label: string
  grade: string
  courses: LectureCourseEntry[]
  total_amount: number
  notes: string
  student: Student
}

export default function LecturesPage() {
  // パスワード認証
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [storedPw, setStoredPw] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [lectures, setLectures] = useState<Lecture[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Lecture | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Lecture | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Form state
  const [formStudentId, setFormStudentId] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [formGrade, setFormGrade] = useState('')
  const [formCourses, setFormCourses] = useState<LectureCourseEntry[]>([
    { course: '', total_lessons: 1, unit_price: 0, subtotal: 0, allocation: [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1, lessons: 1 }] }
  ])
  const [formNotes, setFormNotes] = useState('')

  const handleAuth = async () => {
    if (!password) { toast.error('パスワードを入力してください'); return }
    setVerifying(true)
    try {
      const res = await fetch(`/api/lectures?pw=${encodeURIComponent(password)}`)
      if (res.status === 403) {
        toast.error('パスワードが正しくありません')
        setVerifying(false)
        return
      }
      if (!res.ok) throw new Error('エラーが発生しました')
      const json = await res.json()
      setLectures(json.data || [])
      setStoredPw(password)
      setAuthenticated(true)
      setLoading(false)
    } catch {
      toast.error('認証に失敗しました')
    } finally {
      setVerifying(false)
    }
  }

  const fetchLectures = useCallback(async () => {
    if (!storedPw) return
    const res = await fetch(`/api/lectures?pw=${encodeURIComponent(storedPw)}`)
    const json = await res.json()
    setLectures(json.data || [])
    setLoading(false)
  }, [storedPw])

  const fetchStudents = useCallback(async () => {
    const res = await fetch('/api/students?status=active')
    const json = await res.json()
    setStudents((json.data || []).map((s: Student & Record<string, unknown>) => ({ id: s.id, name: s.name, student_number: s.student_number })))
  }, [])

  useEffect(() => {
    if (!authenticated) return
    fetchLectures(); fetchStudents()
  }, [authenticated, fetchLectures, fetchStudents])

  // 合計金額を計算
  const calcTotal = useCallback(() => {
    if (!formGrade) return 0
    let total = 0
    for (const c of formCourses) {
      if (!c.course || c.total_lessons <= 0) continue
      const unitPrice = calcLectureUnitPrice(formGrade, c.course)
      total += unitPrice * c.total_lessons
    }
    return total
  }, [formGrade, formCourses])

  const makeEmptyCourse = (): LectureCourseEntry => ({
    course: '',
    total_lessons: 1,
    unit_price: 0,
    subtotal: 0,
    allocation: [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1, lessons: 1 }],
  })

  const resetForm = () => {
    setFormStudentId('')
    setFormLabel('')
    setFormGrade('')
    setFormCourses([makeEmptyCourse()])
    setFormNotes('')
    setEditing(null)
  }

  const openEdit = (l: Lecture) => {
    setEditing(l)
    setFormStudentId(l.student_id)
    setFormLabel(l.label)
    setFormGrade(l.grade)
    setFormCourses(l.courses.length ? l.courses : [makeEmptyCourse()])
    setFormNotes(l.notes)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formStudentId) { toast.error('生徒を選択してください'); return }
    if (!formLabel) { toast.error('ラベルを選択してください'); return }
    if (!formGrade) { toast.error('学年を選択してください'); return }
    const validCourses = formCourses.filter(c => c.course && c.total_lessons > 0)
    if (validCourses.length === 0) { toast.error('コースを1つ以上設定してください'); return }

    // allocation 合計チェック
    for (const c of validCourses) {
      const allocSum = c.allocation.reduce((sum, a) => sum + a.lessons, 0)
      if (allocSum !== c.total_lessons) {
        toast.error(`${c.course}: 月別配分の合計(${allocSum})がコマ数(${c.total_lessons})と一致しません`)
        return
      }
    }

    if (saving) return
    setSaving(true)

    const payload = {
      student_id: formStudentId,
      label: formLabel,
      grade: formGrade,
      courses: validCourses,
      notes: formNotes,
    }

    try {
      const url = editing ? `/api/lectures/${editing.id}` : '/api/lectures'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-dashboard-pw': storedPw },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || '保存に失敗しました')
      }
      toast.success(editing ? '更新しました' : '登録しました')
      setDialogOpen(false)
      resetForm()
      fetchLectures()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/lectures/${id}?pw=${encodeURIComponent(storedPw)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('削除しました')
      fetchLectures()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const updateCourse = (index: number, field: string, value: unknown) => {
    setFormCourses(prev => prev.map((c, i) => {
      if (i !== index) return c
      if (field === 'total_lessons') {
        const newLessons = value as number
        // allocation を自動調整（最初の配分行に全コマ数を設定）
        const alloc = c.allocation.length > 0
          ? [{ ...c.allocation[0], lessons: newLessons }, ...c.allocation.slice(1)]
          : [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1, lessons: newLessons }]
        return { ...c, total_lessons: newLessons, allocation: alloc }
      }
      return { ...c, [field]: value }
    }))
  }

  const updateAllocation = (courseIndex: number, allocIndex: number, field: keyof LectureAllocation, value: number) => {
    setFormCourses(prev => prev.map((c, ci) => {
      if (ci !== courseIndex) return c
      const newAlloc = c.allocation.map((a, ai) =>
        ai === allocIndex ? { ...a, [field]: value } : a
      )
      return { ...c, allocation: newAlloc }
    }))
  }

  const addAllocation = (courseIndex: number) => {
    setFormCourses(prev => prev.map((c, ci) => {
      if (ci !== courseIndex) return c
      return {
        ...c,
        allocation: [...c.allocation, { year: new Date().getFullYear(), month: new Date().getMonth() + 1, lessons: 0 }]
      }
    }))
  }

  const removeAllocation = (courseIndex: number, allocIndex: number) => {
    setFormCourses(prev => prev.map((c, ci) => {
      if (ci !== courseIndex) return c
      return { ...c, allocation: c.allocation.filter((_, ai) => ai !== allocIndex) }
    }))
  }

  // パスワード入力画面
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-bold">講習管理</h2>
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

  const filteredLectures = lectures.filter(l => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const name = l.student?.name?.toLowerCase() || ''
    const num = l.student?.student_number?.toLowerCase() || ''
    return name.includes(q) || num.includes(q)
  })

  const formatYen = (n: number) => `¥${n.toLocaleString()}`
  const formatCourses = (courses: LectureCourseEntry[]) =>
    courses.map(c => `${c.course}(${c.total_lessons}コマ)`).join(', ')

  const totalAmount = calcTotal()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">講習管理</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />新規登録</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? '講習編集' : '講習登録'}</DialogTitle></DialogHeader>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ラベル *</Label>
                  <Select value={formLabel} onValueChange={setFormLabel}>
                    <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      {LECTURE_LABELS.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
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
              </div>

              <div className="space-y-3">
                <Label>コース *</Label>
                {formCourses.map((c, ci) => {
                  const unitPrice = formGrade && c.course ? calcLectureUnitPrice(formGrade, c.course) : 0
                  const subtotal = unitPrice * c.total_lessons
                  return (
                    <div key={ci} className="border rounded-md p-3 space-y-3">
                      <div className="flex gap-2 items-center">
                        <Select value={c.course} onValueChange={(v) => updateCourse(ci, 'course', v)}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="コース種別" /></SelectTrigger>
                          <SelectContent>
                            {LECTURE_COURSES.map(name => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" min={1}
                            value={c.total_lessons}
                            onChange={(e) => updateCourse(ci, 'total_lessons', parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">コマ</span>
                        </div>
                        {formCourses.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => setFormCourses(prev => prev.filter((_, j) => j !== ci))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {unitPrice > 0 && (
                        <div className="text-sm text-muted-foreground">
                          単価: {formatYen(unitPrice)} / 小計: {formatYen(subtotal)}
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">月別配分</span>
                          <Button type="button" variant="outline" size="sm" onClick={() => addAllocation(ci)}>
                            <Plus className="h-3 w-3 mr-1" />月追加
                          </Button>
                        </div>
                        {c.allocation.map((a, ai) => (
                          <div key={ai} className="flex gap-2 items-center">
                            <Select value={String(a.year)} onValueChange={(v) => updateAllocation(ci, ai, 'year', parseInt(v))}>
                              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                                  <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={String(a.month)} onValueChange={(v) => updateAllocation(ci, ai, 'month', parseInt(v))}>
                              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                  <SelectItem key={m} value={String(m)}>{m}月</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number" min={0}
                              value={a.lessons}
                              onChange={(e) => updateAllocation(ci, ai, 'lessons', parseInt(e.target.value) || 0)}
                              className="w-20"
                            />
                            <span className="text-sm whitespace-nowrap">コマ</span>
                            {c.allocation.length > 1 && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAllocation(ci, ai)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {(() => {
                          const allocSum = c.allocation.reduce((sum, a) => sum + a.lessons, 0)
                          const diff = c.total_lessons - allocSum
                          if (diff !== 0) {
                            return (
                              <div className="text-sm text-red-500">
                                配分合計: {allocSum}コマ（{diff > 0 ? `${diff}コマ不足` : `${-diff}コマ超過`}）
                              </div>
                            )
                          }
                          return <div className="text-sm text-green-600">配分合計: {allocSum}コマ OK</div>
                        })()}
                      </div>
                    </div>
                  )
                })}
                {formCourses.length < 3 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setFormCourses(prev => [...prev, makeEmptyCourse()])}>
                    <Plus className="h-4 w-4 mr-1" />コース追加
                  </Button>
                )}
              </div>

              {totalAmount > 0 && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <span className="text-sm text-muted-foreground">合計金額（税込）:</span>
                  <span className="ml-2 font-bold text-lg">{formatYen(totalAmount)}</span>
                </div>
              )}

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="生徒名・塾生番号で検索..."
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
                <TableHead>生徒</TableHead>
                <TableHead>ラベル</TableHead>
                <TableHead>学年</TableHead>
                <TableHead>コース</TableHead>
                <TableHead className="text-right">合計金額</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLectures.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    <div>{l.student?.name}</div>
                    {l.student?.student_number && (
                      <div className="text-xs text-muted-foreground">{l.student.student_number}</div>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{l.label}</Badge></TableCell>
                  <TableCell>{l.grade}</TableCell>
                  <TableCell className="text-sm">{formatCourses(l.courses)}</TableCell>
                  <TableCell className="text-right font-mono">{formatYen(l.total_amount)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="編集" onClick={() => openEdit(l)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(l)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLectures.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    講習データがありません
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
        title="講習を削除"
        description={`${deleteTarget?.student?.name}さんの講習（${deleteTarget?.label}）を削除しますか？この操作は取り消せません。`}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.id); setDeleteTarget(null) }}
        confirmLabel="削除する"
      />
    </div>
  )
}

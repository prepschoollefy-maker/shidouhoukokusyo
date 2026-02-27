'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, Search, Lock, ChevronsUpDown, Check } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { useDashboardAuth } from '@/hooks/use-dashboard-auth'

interface Student {
  id: string
  name: string
  student_number: string | null
  grade: string | null
}

interface MaterialSale {
  id: string
  student_id: string
  item_name: string
  unit_price: number
  quantity: number
  total_amount: number
  sale_date: string
  billing_year: number
  billing_month: number
  notes: string
  student: Student
}

export default function MaterialsPage() {
  const { authenticated, password, setPassword, storedPw, verifying, initializing, handleAuth: authHandler } = useDashboardAuth()

  const [materials, setMaterials] = useState<MaterialSale[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MaterialSale | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MaterialSale | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Form state
  const [formStudentId, setFormStudentId] = useState('')
  const [formItemName, setFormItemName] = useState('')
  const [formUnitPrice, setFormUnitPrice] = useState('')
  const [formQuantity, setFormQuantity] = useState('1')
  const [formSaleDate, setFormSaleDate] = useState('')
  const [formBillingYear, setFormBillingYear] = useState(String(new Date().getFullYear()))
  const [formBillingMonth, setFormBillingMonth] = useState(String(new Date().getMonth() + 1))
  const [formNotes, setFormNotes] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentPopoverOpen, setStudentPopoverOpen] = useState(false)

  const handleAuth = () => authHandler('/api/materials')

  const fetchMaterials = useCallback(async () => {
    if (!storedPw) return
    const res = await fetch(`/api/materials?pw=${encodeURIComponent(storedPw)}`)
    const json = await res.json()
    setMaterials(json.data || [])
  }, [storedPw])

  const fetchStudents = useCallback(async () => {
    const res = await fetch('/api/students?status=active')
    const json = await res.json()
    const list = (json.data || []).map((s: Student & Record<string, unknown>) => ({
      id: s.id, name: s.name, student_number: s.student_number, grade: (s.grade as string) || null
    }))
    list.sort((a: Student, b: Student) => (a.student_number || '').localeCompare(b.student_number || '', 'ja', { numeric: true }))
    setStudents(list)
  }, [])

  useEffect(() => {
    if (!authenticated || initializing) return
    setLoading(true)
    Promise.all([fetchMaterials(), fetchStudents()]).finally(() => setLoading(false))
  }, [authenticated, initializing, fetchMaterials, fetchStudents])

  const selectedStudent = students.find(s => s.id === formStudentId)

  const calcTotal = (parseInt(formUnitPrice) || 0) * (parseInt(formQuantity) || 1)

  const resetForm = () => {
    setFormStudentId(''); setFormItemName(''); setFormUnitPrice('')
    setFormQuantity('1'); setFormSaleDate(''); setFormNotes('')
    setFormBillingYear(String(new Date().getFullYear()))
    setFormBillingMonth(String(new Date().getMonth() + 1))
    setStudentSearch(''); setStudentPopoverOpen(false); setEditing(null)
  }

  const openEdit = (m: MaterialSale) => {
    setEditing(m)
    setFormStudentId(m.student_id)
    setFormItemName(m.item_name)
    setFormUnitPrice(String(m.unit_price))
    setFormQuantity(String(m.quantity))
    setFormSaleDate(m.sale_date)
    setFormBillingYear(String(m.billing_year))
    setFormBillingMonth(String(m.billing_month))
    setFormNotes(m.notes)
    setStudentSearch('')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formStudentId) { toast.error('生徒を選択してください'); return }
    if (!formItemName) { toast.error('品名を入力してください'); return }
    if (!formSaleDate) { toast.error('販売日を入力してください'); return }
    if (saving) return
    setSaving(true)

    const payload = {
      student_id: formStudentId,
      item_name: formItemName,
      unit_price: parseInt(formUnitPrice) || 0,
      quantity: parseInt(formQuantity) || 1,
      sale_date: formSaleDate,
      billing_year: parseInt(formBillingYear),
      billing_month: parseInt(formBillingMonth),
      notes: formNotes,
    }

    try {
      const url = editing ? `/api/materials/${editing.id}` : '/api/materials'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-dashboard-pw': storedPw },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || '保存に失敗しました')
      }
      toast.success(editing ? '更新しました' : '登録しました')
      setDialogOpen(false)
      resetForm()
      fetchMaterials()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/materials/${id}?pw=${encodeURIComponent(storedPw)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('削除しました')
      fetchMaterials()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  // パスワード認証画面
  if (initializing) return <LoadingSpinner />
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-bold">教材販売管理</h2>
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

  const formatYen = (n: number) => `¥${n.toLocaleString()}`

  const filteredMaterials = materials.filter(m => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const name = m.student?.name?.toLowerCase() || ''
    const num = m.student?.student_number?.toLowerCase() || ''
    const item = m.item_name.toLowerCase()
    return name.includes(q) || num.includes(q) || item.includes(q)
  })

  const now = new Date()
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">教材販売管理</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />新規登録</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? '教材販売編集' : '教材販売登録'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>生徒 *</Label>
                <Popover open={studentPopoverOpen} onOpenChange={setStudentPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      {selectedStudent
                        ? `${selectedStudent.student_number || ''} ${selectedStudent.name}`
                        : '生徒を選択'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="名前・塾生番号で検索..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {students
                        .filter(s => {
                          if (!studentSearch) return true
                          const q = studentSearch.toLowerCase()
                          return (s.name || '').toLowerCase().includes(q) || (s.student_number || '').includes(q)
                        })
                        .map(s => (
                          <button
                            key={s.id}
                            className="flex items-center w-full px-3 py-2 text-sm hover:bg-muted text-left"
                            onClick={() => { setFormStudentId(s.id); setStudentPopoverOpen(false); setStudentSearch('') }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${formStudentId === s.id ? 'opacity-100' : 'opacity-0'}`} />
                            <span className="text-muted-foreground mr-2">{s.student_number || ''}</span>
                            {s.name}
                          </button>
                        ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>品名 *</Label>
                <Input value={formItemName} onChange={(e) => setFormItemName(e.target.value)} placeholder="例: テキストA" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>単価（税込）</Label>
                  <Input type="number" value={formUnitPrice} onChange={(e) => setFormUnitPrice(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>数量</Label>
                  <Input type="number" min={1} value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} />
                </div>
              </div>
              {calcTotal > 0 && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <span className="text-sm text-muted-foreground">合計金額:</span>
                  <span className="ml-2 font-bold text-lg">{formatYen(calcTotal)}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label>販売日 *</Label>
                <Input type="date" value={formSaleDate} onChange={(e) => setFormSaleDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>請求年</Label>
                  <Input type="number" value={formBillingYear} onChange={(e) => setFormBillingYear(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>請求月</Label>
                  <Input type="number" min={1} max={12} value={formBillingMonth} onChange={(e) => setFormBillingMonth(e.target.value)} />
                </div>
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="生徒名・塾生番号・品名で検索..."
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
                <TableHead>品名</TableHead>
                <TableHead className="text-right">単価</TableHead>
                <TableHead className="text-center">数量</TableHead>
                <TableHead className="text-right">合計</TableHead>
                <TableHead>販売日</TableHead>
                <TableHead>請求月</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    <div>{m.student?.name}</div>
                    {m.student?.student_number && (
                      <div className="text-xs text-muted-foreground">{m.student.student_number}</div>
                    )}
                  </TableCell>
                  <TableCell>{m.item_name}</TableCell>
                  <TableCell className="text-right font-mono">{formatYen(m.unit_price)}</TableCell>
                  <TableCell className="text-center">{m.quantity}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatYen(m.total_amount)}</TableCell>
                  <TableCell className="text-sm">{m.sale_date}</TableCell>
                  <TableCell className="text-sm">{m.billing_year}/{m.billing_month}月</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="編集" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(m)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredMaterials.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    教材販売データがありません
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
        title="教材販売を削除"
        description={`${deleteTarget?.student?.name}さんの「${deleteTarget?.item_name}」を削除しますか？この操作は取り消せません。`}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.id); setDeleteTarget(null) }}
        confirmLabel="削除する"
      />
    </div>
  )
}

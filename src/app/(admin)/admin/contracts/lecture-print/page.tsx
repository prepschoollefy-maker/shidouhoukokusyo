'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useDashboardAuth } from '@/hooks/use-dashboard-auth'
import { Lock, ChevronsUpDown, Check, Eye } from 'lucide-react'
import { toast } from 'sonner'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface Student {
  id: string
  name: string
  name_kana: string | null
  student_number: string | null
  grade: string | null
}

interface TuitionRow {
  courseName: string
  grade: string
  duration: string
  count: string
  amount: string
}

interface DetailRow {
  courseName: string
  schedule: string
  subject: string
  note: string
}

type FormType = 'student' | 'external'

interface FormData {
  type: FormType
  contractNo: string
  createdDate: string
  studentNo: string
  contractStart: string
  contractEnd: string
  studentName: string
  studentKana: string
  parentName: string
  parentKana: string
  tuitionRows: TuitionRow[]
  detailRows: DetailRow[]
  transferDeadline: string
  transferAmount: string
  notes: string
  staffName: string
  // external only
  schoolName: string
  schoolLevel: string
  schoolYear: string
  zipCode: string
  address: string
  parentRelation: string
  parentPhone: string
  parentEmail: string
  studentPhone: string
  studentEmail: string
}

const emptyTuitionRow = (): TuitionRow => ({ courseName: '', grade: '', duration: '', count: '', amount: '' })
const emptyDetailRow = (): DetailRow => ({ courseName: '', schedule: '', subject: '', note: '' })

const initialForm = (): FormData => ({
  type: 'student',
  contractNo: '',
  createdDate: new Date().toISOString().split('T')[0],
  studentNo: '',
  contractStart: '',
  contractEnd: '',
  studentName: '',
  studentKana: '',
  parentName: '',
  parentKana: '',
  tuitionRows: [emptyTuitionRow(), emptyTuitionRow(), emptyTuitionRow()],
  detailRows: [emptyDetailRow(), emptyDetailRow()],
  transferDeadline: '',
  transferAmount: '',
  notes: '',
  staffName: '',
  schoolName: '',
  schoolLevel: '中',
  schoolYear: '',
  zipCode: '',
  address: '',
  parentRelation: '',
  parentPhone: '',
  parentEmail: '',
  studentPhone: '',
  studentEmail: '',
})

const fmt = (n: number) => Math.floor(n).toLocaleString()

/* ================================================================== */
/*  Main Page                                                          */
/* ================================================================== */

export default function LecturePrintPage() {
  const { authenticated, password, setPassword, storedPw, verifying, initializing, handleAuth: authHandler } = useDashboardAuth()
  const handleAuth = () => authHandler('/api/contracts')

  const [mode, setMode] = useState<'input' | 'preview'>('input')
  const [form, setForm] = useState<FormData>(initialForm())
  const [students, setStudents] = useState<Student[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [studentPopoverOpen, setStudentPopoverOpen] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState('')

  const fetchStudents = useCallback(async () => {
    const res = await fetch('/api/students?status=active')
    const json = await res.json()
    const list = (json.data || []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      name: s.name as string,
      name_kana: (s.name_kana as string) || null,
      student_number: (s.student_number as string) || null,
      grade: (s.grade as string) || null,
    }))
    list.sort((a: Student, b: Student) => (a.student_number || '').localeCompare(b.student_number || '', 'ja', { numeric: true }))
    setStudents(list)
  }, [])

  useEffect(() => {
    if (!authenticated || initializing) return
    fetchStudents()
  }, [authenticated, initializing, fetchStudents])

  const updateForm = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const updateTuitionRow = (i: number, field: keyof TuitionRow, value: string) => {
    setForm(prev => ({
      ...prev,
      tuitionRows: prev.tuitionRows.map((r, j) => j === i ? { ...r, [field]: value } : r),
    }))
  }

  const updateDetailRow = (i: number, field: keyof DetailRow, value: string) => {
    setForm(prev => ({
      ...prev,
      detailRows: prev.detailRows.map((r, j) => j === i ? { ...r, [field]: value } : r),
    }))
  }

  const addTuitionRow = () => {
    if (form.tuitionRows.length < 5) {
      setForm(prev => ({ ...prev, tuitionRows: [...prev.tuitionRows, emptyTuitionRow()] }))
    }
  }

  const removeTuitionRow = (i: number) => {
    if (form.tuitionRows.length > 1) {
      setForm(prev => ({ ...prev, tuitionRows: prev.tuitionRows.filter((_, j) => j !== i) }))
    }
  }

  const addDetailRow = () => {
    if (form.detailRows.length < 4) {
      setForm(prev => ({ ...prev, detailRows: [...prev.detailRows, emptyDetailRow()] }))
    }
  }

  const removeDetailRow = (i: number) => {
    if (form.detailRows.length > 1) {
      setForm(prev => ({ ...prev, detailRows: prev.detailRows.filter((_, j) => j !== i) }))
    }
  }

  // Auto-calc tuition total (tax included)
  const tuitionTotal = form.tuitionRows.reduce((sum, r) => sum + (parseInt(r.amount) || 0), 0)

  // Select student -> auto-fill
  const selectStudent = (s: Student) => {
    setSelectedStudentId(s.id)
    setStudentPopoverOpen(false)
    setStudentSearch('')
    setForm(prev => ({
      ...prev,
      studentName: s.name,
      studentKana: s.name_kana || '',
      studentNo: s.student_number || '',
    }))
  }

  const handlePreview = () => {
    if (!form.studentName) {
      toast.error('生徒氏名を入力してください')
      return
    }
    setMode('preview')
  }

  if (initializing) return <LoadingSpinner />
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-bold">講習申込書作成</h2>
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

  if (mode === 'preview') {
    return <PreviewMode form={form} tuitionTotal={tuitionTotal} onBack={() => setMode('input')} />
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">講習受講申込書作成</h2>
        <Button onClick={handlePreview}>
          <Eye className="h-4 w-4 mr-1" />プレビュー・印刷
        </Button>
      </div>

      {/* Type toggle */}
      <Card>
        <CardContent className="p-4">
          <Label className="mb-2 block">書類種別</Label>
          <div className="flex rounded-lg border overflow-hidden w-fit">
            {([['student', '塾生用'], ['external', '外部生（講習生）用']] as const).map(([key, label]) => (
              <button
                key={key}
                className={`px-4 py-2 text-sm font-medium transition-colors ${form.type === key ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                onClick={() => updateForm('type', key)}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Basic info */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold">基本情報</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>契約書No.</Label>
              <Input value={form.contractNo} onChange={e => updateForm('contractNo', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>作成日</Label>
              <Input type="date" value={form.createdDate} onChange={e => updateForm('createdDate', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{form.type === 'student' ? '塾生No.' : '講習生No.'}</Label>
              <Input value={form.studentNo} onChange={e => updateForm('studentNo', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>契約期間（開始）</Label>
                <Input type="date" value={form.contractStart} onChange={e => updateForm('contractStart', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>契約期間（終了）</Label>
                <Input type="date" value={form.contractEnd} onChange={e => updateForm('contractEnd', e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student / Parent info */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold">生徒・保護者情報</h3>

          {form.type === 'student' && (
            <div className="space-y-2">
              <Label>生徒選択（塾生用）</Label>
              <Popover open={studentPopoverOpen} onOpenChange={setStudentPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {selectedStudentId
                      ? (() => { const s = students.find(s => s.id === selectedStudentId); return s ? `${s.student_number || ''} ${s.name}` : '生徒を選択' })()
                      : '生徒を選択（氏名・番号を自動入力）'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="名前・塾生番号で検索..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
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
                          onClick={() => selectStudent(s)}
                        >
                          <Check className={`mr-2 h-4 w-4 ${selectedStudentId === s.id ? 'opacity-100' : 'opacity-0'}`} />
                          <span className="text-muted-foreground mr-2">{s.student_number || ''}</span>
                          {s.name}
                          {s.grade && <span className="ml-2 text-xs text-muted-foreground">({s.grade})</span>}
                        </button>
                      ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>生徒氏名</Label>
              <Input value={form.studentName} onChange={e => updateForm('studentName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>フリガナ</Label>
              <Input value={form.studentKana} onChange={e => updateForm('studentKana', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>保護者氏名</Label>
              <Input value={form.parentName} onChange={e => updateForm('parentName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>フリガナ</Label>
              <Input value={form.parentKana} onChange={e => updateForm('parentKana', e.target.value)} />
            </div>
          </div>

          {/* External-only fields */}
          {form.type === 'external' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>在籍学校名</Label>
                  <Input value={form.schoolName} onChange={e => updateForm('schoolName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>学校種別</Label>
                  <div className="flex rounded-lg border overflow-hidden w-fit mt-1">
                    {['小', '中', '高'].map(level => (
                      <button
                        key={level}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${form.schoolLevel === level ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                        onClick={() => updateForm('schoolLevel', level)}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>学年</Label>
                  <Input value={form.schoolYear} onChange={e => updateForm('schoolYear', e.target.value)} placeholder="例: 2" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>郵便番号</Label>
                  <Input value={form.zipCode} onChange={e => updateForm('zipCode', e.target.value)} placeholder="000-0000" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>住所</Label>
                  <Input value={form.address} onChange={e => updateForm('address', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">緊急連絡先（保護者）</h4>
                  <div className="space-y-2">
                    <Label>ご関係</Label>
                    <Input value={form.parentRelation} onChange={e => updateForm('parentRelation', e.target.value)} placeholder="例: 母" />
                  </div>
                  <div className="space-y-2">
                    <Label>電話番号</Label>
                    <Input value={form.parentPhone} onChange={e => updateForm('parentPhone', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>メール</Label>
                    <Input value={form.parentEmail} onChange={e => updateForm('parentEmail', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">講習生連絡先</h4>
                  <div className="space-y-2">
                    <Label>電話番号</Label>
                    <Input value={form.studentPhone} onChange={e => updateForm('studentPhone', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>メール</Label>
                    <Input value={form.studentEmail} onChange={e => updateForm('studentEmail', e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tuition table */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">受講料</h3>
            {form.tuitionRows.length < 5 && (
              <Button variant="outline" size="sm" onClick={addTuitionRow}>+ 行追加</Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 px-2">コース・講座名</th>
                  <th className="text-left py-1 px-2 w-20">学年</th>
                  <th className="text-left py-1 px-2 w-24">授業時間(分)</th>
                  <th className="text-left py-1 px-2 w-20">授業数(回)</th>
                  <th className="text-left py-1 px-2 w-28">受講料(円)</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {form.tuitionRows.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1 px-2"><Input value={row.courseName} onChange={e => updateTuitionRow(i, 'courseName', e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-2"><Input value={row.grade} onChange={e => updateTuitionRow(i, 'grade', e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-2"><Input value={row.duration} onChange={e => updateTuitionRow(i, 'duration', e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-2"><Input value={row.count} onChange={e => updateTuitionRow(i, 'count', e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-2"><Input value={row.amount} onChange={e => updateTuitionRow(i, 'amount', e.target.value)} className="h-8 text-right" /></td>
                    <td className="py-1 px-2">
                      {form.tuitionRows.length > 1 && (
                        <button onClick={() => removeTuitionRow(i)} className="text-red-400 hover:text-red-600 text-xs">x</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end items-center gap-2 text-sm">
            <span className="text-muted-foreground">受講料合計（税込）:</span>
            <span className="font-bold text-lg">{tuitionTotal > 0 ? `¥${fmt(tuitionTotal)}` : '---'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Detail table */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">受講内容の詳細</h3>
            {form.detailRows.length < 4 && (
              <Button variant="outline" size="sm" onClick={addDetailRow}>+ 行追加</Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 px-2">コース・講座名</th>
                  <th className="text-left py-1 px-2">受講日・時間帯</th>
                  <th className="text-left py-1 px-2 w-24">科目</th>
                  <th className="text-left py-1 px-2 w-32">備考</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {form.detailRows.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1 px-2"><Input value={row.courseName} onChange={e => updateDetailRow(i, 'courseName', e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-2"><Input value={row.schedule} onChange={e => updateDetailRow(i, 'schedule', e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-2"><Input value={row.subject} onChange={e => updateDetailRow(i, 'subject', e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-2"><Input value={row.note} onChange={e => updateDetailRow(i, 'note', e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-2">
                      {form.detailRows.length > 1 && (
                        <button onClick={() => removeDetailRow(i)} className="text-red-400 hover:text-red-600 text-xs">x</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Transfer & Notes */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold">振込情報</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>振込締切日</Label>
              <Input type="date" value={form.transferDeadline} onChange={e => updateForm('transferDeadline', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>振込金額</Label>
              <Input value={form.transferAmount} onChange={e => updateForm('transferAmount', e.target.value)} placeholder="自動計算値と異なる場合のみ入力" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold">その他</h3>
          <div className="space-y-2">
            <Label>特記事項</Label>
            <Textarea value={form.notes} onChange={e => updateForm('notes', e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>契約担当者名</Label>
            <Input value={form.staffName} onChange={e => updateForm('staffName', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center pb-8">
        <Button size="lg" onClick={handlePreview}>
          <Eye className="h-4 w-4 mr-2" />プレビュー・印刷
        </Button>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Preview / Print Mode                                               */
/* ================================================================== */

function PreviewMode({ form, tuitionTotal, onBack }: { form: FormData; tuitionTotal: number; onBack: () => void }) {
  const isExternal = form.type === 'external'
  const label = isExternal ? '講習生' : '塾生'
  const titleText = isExternal ? '講習受講申込書（外部生用）' : '講習受講申込書'

  // A3 auto-scale
  useEffect(() => {
    const fitPages = () => {
      const MAX_H = 394 * 3.7795
      document.querySelectorAll<HTMLElement>('.sheet-inner').forEach(inner => {
        inner.style.transform = ''
        inner.style.width = ''
        const h = inner.scrollHeight
        if (h > MAX_H) {
          const s = MAX_H / h
          inner.style.transform = `scale(${s.toFixed(4)})`
          inner.style.transformOrigin = 'top left'
          inner.style.width = `${(100 / s).toFixed(2)}%`
        }
      })
    }
    const t = setTimeout(fitPages, 100)
    window.addEventListener('beforeprint', fitPages)
    return () => { clearTimeout(t); window.removeEventListener('beforeprint', fitPages) }
  }, [])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }

  const displayTransferAmount = form.transferAmount || (tuitionTotal > 0 ? fmt(tuitionTotal) : '')

  const emptyTuitionPad = Math.max(0, 5 - form.tuitionRows.length)
  const emptyDetailPad = Math.max(0, 4 - form.detailRows.length)

  return (
    <>
      <LecturePrintStyles />
      <div className="contract-page">
        {/* Action bar */}
        <div className="no-print action-bar">
          <button onClick={() => window.print()} className="btn-primary">
            印刷 / PDF保存
          </button>
          <button onClick={onBack} className="btn-secondary">
            入力に戻る
          </button>
        </div>

        {/* Page 1: Front */}
        <div className="contract-sheet page-front">
          <div className="sheet-inner">
            {/* Header */}
            <div className="contract-header">
              <div><span className="header-notice red-box">表面及び裏面の内容を十分にお読みください。</span></div>
              <div>
                <table className="header-info"><tbody><tr><th>契約書No.</th><td>{form.contractNo}</td></tr></tbody></table>
              </div>
            </div>
            <div className="header-row2">
              <span>{label}No.　{form.studentNo}　　生徒名　{form.studentName}</span>
              <span>作成日　{formatDate(form.createdDate)}</span>
            </div>

            <h1 className="contract-title">{titleText}</h1>

            <p className="preamble">
              私（下欄に記載の「契約者」）は、本契約書の表面及び裏面の契約内容を了承のうえ、本日、株式会社レフィー（以下「レフィー」）に対して表記{label}の講習受講の申込みを行い、レフィーはこれを承諾しました。<br />
              また、契約者は、本日、本契約書の控えを受領いたしました。
            </p>

            <div className="contract-period">
              <strong>契約期間</strong>　　{formatDate(form.contractStart)}　～　{formatDate(form.contractEnd)}
            </div>

            {/* Student / Parent info */}
            <h2 className="section-title">&#9632; {label}/契約者情報</h2>
            <table className="info-table">
              <tbody>
                <tr>
                  <th>フリガナ</th><td className="handwrite">{form.studentKana}</td>
                  <th>フリガナ</th><td className="handwrite">{form.parentKana}</td>
                </tr>
                <tr>
                  <th>{label}（生徒）氏名</th><td className="handwrite">{form.studentName}</td>
                  <th>契約者（保護者）氏名</th><td className="handwrite">{form.parentName}</td>
                </tr>
                {isExternal ? (
                  <>
                    <tr>
                      <th>在籍学校名</th><td className="handwrite">{form.schoolName}</td>
                      <th>学年</th><td className="handwrite">　　{form.schoolLevel}　{form.schoolYear}年</td>
                    </tr>
                    <tr>
                      <th>住所</th>
                      <td colSpan={3} className="handwrite">
                        〒{form.zipCode}<br />{form.address}
                      </td>
                    </tr>
                    <tr>
                      <th>緊急連絡先<br /><span className="th-sub">（保護者様）</span></th>
                      <td className="handwrite">
                        ご関係（{form.parentRelation}）<br />
                        電話番号：{form.parentPhone}<br />
                        メール：{form.parentEmail}
                      </td>
                      <th>{label}連絡先</th>
                      <td className="handwrite">
                        電話番号：{form.studentPhone}<br />
                        メール：{form.studentEmail}
                      </td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <th>在籍学校名</th><td className="handwrite"></td>
                      <th>学年</th><td className="handwrite">　　小　・　中　・　高　　　　　　年</td>
                    </tr>
                    <tr>
                      <th>住所</th>
                      <td colSpan={3} className="handwrite">〒　　　　　　　-<br /><br /></td>
                    </tr>
                    <tr>
                      <th>緊急連絡先<br /><span className="th-sub">（保護者様）</span></th>
                      <td className="handwrite"><br />ご関係（　　　　　　　）<br />電話番号：<br />メール：</td>
                      <th>{label}連絡先</th>
                      <td className="handwrite"><br />電話番号：<br />メール：</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            {/* Tuition table */}
            <h2 className="section-title">&#9632; 受講料</h2>
            <p className="note-small">※以下に記載の税込み価格は、すべて消費税10％で計算しています。</p>
            <table className="tuition-table tuition-full">
              <thead>
                <tr><th>コース・講座名</th><th>学年</th><th>授業時間(分)</th><th>授業数(回)</th><th>受講料(円)</th></tr>
              </thead>
              <tbody>
                {form.tuitionRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.courseName}</td><td>{r.grade}</td><td>{r.duration}</td><td>{r.count}</td>
                    <td className="num">{r.amount ? fmt(parseInt(r.amount) || 0) : ''}</td>
                  </tr>
                ))}
                {Array.from({ length: emptyTuitionPad }).map((_, i) => (
                  <tr key={`e${i}`}><td></td><td></td><td></td><td></td><td></td></tr>
                ))}
                <tr className="total-row">
                  <td colSpan={4}><strong>受講料合計（税込）</strong></td>
                  <td className="num"><strong>{tuitionTotal > 0 ? fmt(tuitionTotal) : ''}</strong></td>
                </tr>
              </tbody>
            </table>

            {/* Detail table */}
            <h2 className="section-title">&#9632; 受講内容の詳細</h2>
            <table className="tuition-table tuition-full">
              <thead>
                <tr><th>コース・講座名</th><th>受講日・時間帯</th><th>科目</th><th>備考</th></tr>
              </thead>
              <tbody>
                {form.detailRows.map((r, i) => (
                  <tr key={i}><td>{r.courseName}</td><td>{r.schedule}</td><td>{r.subject}</td><td>{r.note}</td></tr>
                ))}
                {Array.from({ length: emptyDetailPad }).map((_, i) => (
                  <tr key={`e${i}`}><td></td><td></td><td></td><td></td></tr>
                ))}
              </tbody>
            </table>

            {/* Transfer info */}
            <h2 className="section-title">&#9632; お振り込み金額</h2>
            <table className="payment-table">
              <tbody>
                <tr>
                  <th>受講料合計</th>
                  <td className="num"><strong>{displayTransferAmount ? `¥${displayTransferAmount}` : ''}</strong></td>
                  <td className="handwrite-deadline">お振込締切日　　{formatDate(form.transferDeadline)}</td>
                </tr>
              </tbody>
            </table>

            {/* Bank */}
            <h2 className="section-title">&#9632; お振り込み先口座</h2>
            <table className="bank-table">
              <tbody>
                <tr>
                  <th>金融機関・支店名</th><td>横浜信用金庫　横浜西口支店（金融機関コード：1280、支店コード: 023）</td>
                  <th>口座番号</th><td>(普)0601013</td>
                  <th>口座名義</th><td>株式会社レフィー</td>
                </tr>
              </tbody>
            </table>
            <p className="note-small">※振込人名義は、必ず{label}No.とご契約者（保護者）様氏名をご入力ください。　例：1234567ｺﾍﾞﾂﾀﾛｳ</p>

            {/* Notes */}
            <h2 className="section-title">&#9632; 特記事項</h2>
            <div className="notes-box">{form.notes || ''}</div>

            {/* Confirm */}
            <h2 className="section-title">&#9632; 契約者（保護者）様ご記入欄</h2>
            <table className="confirm-table">
              <tbody>
                <tr>
                  <th rowSpan={2}>ご確認<br />事項</th>
                  <td>&#9312; 裏面約款はご確認いただけましたか<br /><span className="checkbox-line">&#9633; はい</span></td>
                  <td>&#9313; 納入金および納入スケジュールはご確認いただけましたか<br /><span className="checkbox-line">&#9633; はい</span></td>
                </tr>
                <tr>
                  <td>&#9314; 別紙記載の「個人情報の取り扱いについて」に記載されている内容について<br /><span className="checkbox-line">&#9633; 同意する</span></td>
                  <td>&#9315; 受講のご案内をご確認いただけましたか<br /><span className="checkbox-line">&#9633; はい</span></td>
                </tr>
              </tbody>
            </table>

            {/* Signature */}
            <div className="signature-section">
              <p><strong>ご署名欄</strong>　本契約を締結し、本契約書（表面及び裏面）の控えを確かに受け取りました。</p>
              <table className="signature-table">
                <tbody>
                  <tr>
                    <th>ご署名日</th><td className="handwrite">　　　　年　　　月　　　日</td>
                    <th>契約者（保護者）氏名</th><td className="handwrite"></td><td className="seal">印</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Company */}
            <div className="company-section">
              <div className="company-info">
                <p><strong>株式会社 レフィー</strong></p>
                <p>代表取締役：山本博之</p>
                <p>神奈川県横浜市神奈川区鶴屋町三丁目33-7 横浜OSビル 201　電話番号：045-620-9150</p>
              </div>
              <div className="staff-info">
                <table className="signature-table">
                  <tbody>
                    <tr><th>契約担当者</th><td className="handwrite">{form.staffName}</td><td className="seal">印</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Direct negotiation */}
            <div className="legal-section">
              <p><strong>【直接交渉の禁止】</strong></p>
              <p className="small-text">レフィーの{label}及びその保護者は、契約期間中や契約期間終了後であっても、レフィーが派遣または雇用している講師及びその紹介により知り得た講師から、レフィーの承諾なしに指導を受けること、指導の契約をすることはできないものとします。（直接交渉の損害賠償金） レフィーの{label}及びその保護者が、レフィーの承諾なく前項に違反または違反しようとした場合、損失相当分をお支払いいただく場合がございます。</p>
            </div>

            {/* Cooling-off */}
            <div className="cooling-off-section">
              <p className="cooling-off-title">【クーリング・オフに関しまして】</p>
              <div className="cooling-off-body">
                <p>契約書面を受領した日から起算して8日を経過するまでは、書面または電磁的記録により無条件に契約の解除ができます。既にお支払いいただいている費用、授業料は、以下に記す期日に{label}および契約者が指定した銀行口座へ銀行振込にて返金いたします。１：［1~15日に受付］受付した月の月末に返金いたします。２：［16~末日に受付］受付した月の翌月の15日に返金いたします。（＊15日、末日が銀行休業日の場合は、翌銀行営業日に返金いたします。）</p>
                <p>1.クーリング・オフの効カはクーリング・オフを通知する書面または電磁的記録を弊社に発した時から生じます。<br />
                2.クーリング・オフ受付後は、損害賠償または違約金を支払う必要はありません。<br />
                3.クーリング・オフとなった場合、既に指導が開始されていたとしても授業料やその他の支払いをする必要はありません。<br />
                4.弊社がクーリング・オフ、解約に関する事項につき不実のことを告げ、誤認や威圧したことにより困感したことで、クーリング・オフを行わなかった場合には、当該契約の申込撤回又は解除を行うことができる旨を記載して交付した書面を受領した日から起算して8日を経過するまでは、書面または電磁的記録により当該契約のクーリング・オフをすることができます。<br />
                5.クーリング・オフとなった場合、関連商品についても契約の解除ができます。<br />
                6.効力は、クーリング・オフを弊社に通知する書面または電磁的記録を発した時より生じ、クーリング・オフにより、損害賠償または違約金を支払う必要はありません。<br />
                7.また、関連商品の引き取りに要する費用は弊社が負担いたします。<br />
                尚、既に金銭の受領があった場合は、適やかに全額を返金いたします。</p>
              </div>
            </div>
          </div>
        </div>

        {/* Page 2: Back (Terms) */}
        <div className="contract-sheet page-back">
          <div className="sheet-inner">
            <h1 className="contract-title">講習受講申込書　約款</h1>
            <div className="terms-columns">
              <div className="terms-col">
                <LectureTermArticle n={1} title="指導の目的" paragraphs={[
                  `本契約は、レフィーが定める各コースの条件を満たした講師による${label}への学習指導及びそれに付随する以下のサービスの提供を目的とします。${label}への役務は、学習指導及びそれに付随するサービスに限ります。`,
                  `レフィーは${label}の成績向上のため努力しますが、直ちに成績向上等をお約束するものではありません。また、学習以外の事項、授業を受講する教室までの行き来に起きた事故に関して、一切の責任を負いかねます。`,
                ]} />
                <LectureTermArticle n={2} title="受講料" paragraphs={[
                  '受講料は表面記載のとおりとします。契約期間中であっても、レフィーは法令の改廃、経済情勢の変動、租税公課の増減により、受講料等を改定することができます。',
                  '受講料は、契約締結日から3日以内に、弊社指定の銀行口座にご入金いただきます。振込手数料はご契約者様にご負担いただきます。',
                  '授業終了時点で既にお支払いいただいている受講料が、実際の授業回数に基づき計算された受講料に満たない場合、その不足額を追加請求させていただきます。また、講習の契約期間満了時点における未実施分の受講料は、返金いたしかねます。',
                ]} />
                <LectureTermArticle n={3} title="振替授業" paragraphs={[
                  `振替授業を希望する場合、授業予定日の１営業日前の18時までにお申し出ください。前日の18時を過ぎた場合は、予定どおり授業を実施することとし、振替はできかねます。ただし、振替授業は、契約期間内において繰越しすることができます。尚、ブースの空き状況や講師のスケジュールによって振替希望が充たされない場合があります。`,
                  '災害等緊急事象を理由とした休講の場合、振替はできません。',
                ]} />
                <LectureTermArticle n={4} title="契約期間" paragraphs={[
                  '契約期間は、表面記載のとおりとします。',
                ]} />
                <LectureTermArticle n={5} title="一部契約変更、休止" paragraphs={[
                  `${label}および契約者が本契約の内容（コース、授業時間、科目）を一部変更、または休止する場合は、変更、休止を希望する日の1週間以上前に申し出るものとします。`,
                ]} />
                <LectureTermArticle n={6} title="中途解約" paragraphs={[
                  `${label}および契約者はクーリング・オフ期間経過後も、下記の（授業開始前）、（授業開始後）の区分に従い、いつでも契約を解除することができます。`,
                  '<strong>（授業開始前）</strong>学習計画立案、講師決定の対価として、以下のとおり、お支払いいただきます。（１）学習塾の（当塾で授業を受ける）場合、1万1千円をお支払いいただきます。',
                  '<strong>（授業開始後）</strong>下記a及びbの合計額をお支払いいただきます。a. 中途解約時点で既にお支払いいただいている受講料が実際の授業回数に基づき計算された受講料に満たない場合、その不足額　b. 中途解約時点の受講料か以下のうち、いずれか低い額（違約金）（１）学習塾の（当塾で授業を受ける）場合、2万円をお支払いいただきます。',
                  `尚、上記a及びbの合計額をお支払いの上、うちbの金額を受講料に充当し、残りの講習期間内で授業を受けていただくことができます。尚、違約金を受講料に充当して授業が行われなかった場合においてもご返金いたしかねます。授業開始後は、実施分の受講料については返金いたしかねます。中途解約時点における未実施分の授業については、${label}および契約者にご確認の上、振替授業またはご返金いたします。`,
                ]} />
                <LectureTermArticle n={7} title="受講料未納に対する措置" paragraphs={[
                  `${label}および契約者が本来の支払期日を超えて受講料が未納の場合、レフィーは一旦授業を中断し、入金確認後、授業を再開することができるものとします。`,
                ]} />
                <LectureTermArticle n={8} title="講師の決定および交代について" paragraphs={[
                  `［講師の決定］レフィーは${label}の要望に基づき、講師を決定するものとします。`,
                  `［講師の交代］${label}は、担当講師の交代を要求し、契約期間中に最大３回まで、講師を変更できるものとします。なお、講師の交代に際して別途の費用などは生じません。`,
                  `［レフィーからの交代依頼］講師の事情でやむを得ない場合、${label}に対して、講師の交代、もしくは、一時的に別講師の授業を受講いただくことなどを相談することがあります。`,
                ]} />
                <LectureTermArticle n={9} title="損害賠償" paragraphs={[
                  '当塾の施設内で発生した事故について法律上の損害賠償責任を負うべき場合は相応の賠償を行います。ただし当塾の管理下にない間に発生した事故、当塾内において発生した盗難及び紛失については一切損害賠償の責任は負いません。',
                ]} />
              </div>
              <div className="terms-col">
                <LectureTermArticle n={10} title="契約の解除" paragraphs={[
                  `レフィーは、${label}について次の各号のいずれかに該当する事由が生じたときは、何らの催告を要せず、直ちに、本契約の全部又は一部を解除することができます。`,
                  `（１）${label}の素行に著しく問題がある場合。（２）欠席が多く、${label}の学習意欲が低い場合。（３）他の${label}の学習を阻害する言動を注意しても、改めない場合。（４）教室の業務を著しく妨げるような言動を${label}が繰り返した場合。（５）法律に違反する行為が${label}にあった場合。`,
                ]} />
                <LectureTermArticle n={11} title="レフィーへの報告のお願い" paragraphs={[
                  `${label}は、授業の成果の確認、今後の指導方法の改善、学習計画の立案のため、必要に応じて学校の通知表やテストの結果および模試の結果をレフィーヘ報告するものとします。`,
                  `${label}は、講師の勤務態度及び指導内容に疑義があるときは直ちにレフィーへ報告するものとします。`,
                ]} />
                <LectureTermArticle n={12} title="レフィーへの通知" paragraphs={[
                  `保護者または${label}の住所又は電話番号又はメールアドレスに変更等が生じたときは直ちにレフィーヘ通知するものとします。`,
                ]} />
                <LectureTermArticle n={13} title="緊急時対応" paragraphs={[
                  `臨時休校措置について：自然災害、感染症の流行、凶悪犯罪の発生、その他の災害等緊急事象の発生またはその恐れにより、特別警報、警報、避難指示・勧告や緊急事態宣言等による要請・指示等がなされた地域・地区においては、${label}の身体生命等の安全確保のために休講を決定することがあります。ただし、このように災害等緊急事象を理由とした休講の場合、原則として振替授業は行いません。`,
                  `${label}が教室にいるときに災害が発生した場合：避難が必要とされる場合、指定避難所に${label}を引率のうえ、避難致します。災害等緊急事象発生時には、弊社公式ホームページにご連絡方法を掲載いたします。また、個別にメール・お電話にてご連絡いたします。`,
                  `${label}が教室にいるときに急病・けがをされた場合：保護者様ご指定の緊急連絡先にご連絡のうえ、お迎えをお願いしたり、状況に応じて最寄りの医療機関を受診いただいたりする場合があります。教室職員判断による医療行為（投薬など）はいたしかねますのでご了承ください。`,
                ]} />
                <LectureTermArticle n={14} title="補足" paragraphs={[
                  'レフィーでは、「抗弁権の接続」の対象となるローン提携販売、信用販売購入は行っておりません。また、前受金については、保全措置を行っておりません。',
                ]} />
                <LectureTermArticle n={15} title="反社会的勢力の排除" paragraphs={[
                  `(1)契約者および${label}は、暴力団等反社会的勢力に属さず、関与していないこと、また、将来にわたり属さず、関与しないことを確約するものとします。(2)レフィーは、契約者および${label}が暴力団等反社会的勢力に属したり、関与したりしていると判明した場合、催告することなく、将来に向かって本契約を解除できるものとします。(3)前項の契約解除があった場合、レフィーはこれによる契約者および${label}の損害を賠償する責を負いません。`,
                ]} />
                <LectureTermArticle n={16} title="規約の変更等" paragraphs={[
                  '本規約の内容は予告なく変更、改定または廃止をする場合があります。',
                ]} />
                <LectureTermArticle n={17} title="協議事項" paragraphs={[
                  `本規約に定めのない事項及び本規約の条項のうち疑義が生じた場合については、契約者とレフィーが協議して取り決めるものとします。`,
                ]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function LectureTermArticle({ n, title, paragraphs }: { n: number; title: string; paragraphs: string[] }) {
  return (
    <div className="term-article">
      <h3>{n}. {title}</h3>
      {paragraphs.map((p, i) => (
        <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
      ))}
    </div>
  )
}

/* ================================================================== */
/*  CSS (same pattern as contracts/print/[id]/page.tsx)                */
/* ================================================================== */

function LecturePrintStyles() {
  return (
    <style>{`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: "Yu Gothic","YuGothic","Hiragino Sans","Meiryo",sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
      /* Hide admin layout (sidebar, header, main padding) */
      aside { display: none !important; }
      header { display: none !important; }
      main { margin-left: 0 !important; }
      main > div { padding: 0 !important; }
      .contract-page { background: #e0e0e0; }
      .action-bar { position: fixed; top: 0; left: 0; right: 0; background: #2c3e50; padding: 0.75rem 2rem; z-index: 100; text-align: center; }
      .btn-primary { background: linear-gradient(135deg,#2980b9,#1a5276); color: #fff; border: none; padding: 0.75rem 2rem; font-size: 1rem; border-radius: 4px; cursor: pointer; font-weight: bold; }
      .btn-secondary { display: inline-block; background: #95a5a6; color: #fff; border: none; padding: 0.75rem 2rem; font-size: 1rem; border-radius: 4px; cursor: pointer; text-decoration: none; margin-left: 1rem; }
      .contract-sheet { width: 297mm; height: 420mm; margin: 60px auto 20px; padding: 10mm 14mm; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 10.5pt; overflow: hidden; position: relative; }
      .sheet-inner { width: 100%; height: 100%; transform-origin: top left; }
      .contract-sheet + .contract-sheet { margin-top: 20px; }
      .contract-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1mm; }
      .header-notice { font-size: 9pt; }
      .red-box { color: #cc0000; border: 2px solid #cc0000; padding: 0.1rem 0.3rem; font-weight: bold; display: inline-block; }
      .header-info { border-collapse: collapse; font-size: 10pt; }
      .header-info th { text-align: left; padding: 0.1rem 0.3rem; font-weight: normal; white-space: nowrap; }
      .header-info td { padding: 0.1rem 0.3rem; border-bottom: 1px solid #999; min-width: 60px; }
      .header-row2 { display: flex; justify-content: space-between; font-size: 10pt; margin-bottom: 1mm; }
      .contract-title { text-align: center; font-size: 16pt; margin: 1mm 0; letter-spacing: 0.3em; }
      .preamble { font-size: 9pt; margin-bottom: 1mm; line-height: 1.4; }
      .contract-period { margin-bottom: 1mm; font-size: 10pt; }
      .section-title { font-size: 10pt; margin: 1.5mm 0 1mm; }
      .info-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 1.5mm; }
      .info-table th, .info-table td { border: 1px solid #333; padding: 1mm 1.5mm; vertical-align: top; }
      .info-table th { background: #f0f0f0; font-weight: bold; white-space: nowrap; width: 11%; font-size: 8.5pt; }
      .info-table .handwrite { min-height: 5mm; background: #fff; }
      .th-sub { font-weight: normal; font-size: 7.5pt; }
      .note-small { font-size: 7.5pt; color: #555; margin-bottom: 1mm; }
      .tuition-full { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 1.5mm; }
      .tuition-full th, .tuition-full td { border: 1px solid #333; padding: 0.5mm 1.5mm; }
      .tuition-full thead th { background: #f0f0f0; font-weight: bold; text-align: center; font-size: 8.5pt; }
      .tuition-full .num { text-align: right; white-space: nowrap; }
      .tuition-full .total-row td { background: #e8e8e8; }
      .tuition-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 1.5mm; }
      .tuition-table th, .tuition-table td { border: 1px solid #333; padding: 0.5mm 1.5mm; }
      .tuition-table thead th { background: #f0f0f0; font-weight: bold; text-align: center; font-size: 8.5pt; }
      .tuition-table .num { text-align: right; white-space: nowrap; }
      .tuition-table .total-row td { background: #e8e8e8; }
      .payment-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 1mm; }
      .payment-table th, .payment-table td { border: 1px solid #333; padding: 0.5mm 1.5mm; }
      .payment-table th { background: #f0f0f0; font-weight: bold; text-align: left; white-space: nowrap; }
      .payment-table .num { text-align: right; white-space: nowrap; }
      .payment-table .total-row th, .payment-table .total-row td { background: #e8e8e8; }
      .payment-table .handwrite-deadline { font-size: 8.5pt; text-align: center; vertical-align: middle; min-width: 110px; background: #fff; }
      .bank-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 0.5mm; }
      .bank-table th, .bank-table td { border: 1px solid #333; padding: 0.5mm 1mm; }
      .bank-table th { background: #f0f0f0; font-weight: bold; white-space: nowrap; }
      .notes-box { border: 1px solid #333; padding: 1mm 2mm; min-height: 5mm; max-height: 15mm; font-size: 9pt; margin-bottom: 1.5mm; white-space: pre-wrap; overflow: hidden; }
      .confirm-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 1.5mm; }
      .confirm-table th, .confirm-table td { border: 1px solid #333; padding: 0.5mm 1.5mm; vertical-align: top; }
      .confirm-table th { background: #f0f0f0; font-weight: bold; width: 8%; text-align: center; }
      .checkbox-line { display: inline-block; margin-top: 0.5mm; }
      .signature-section { margin: 1.5mm 0; font-size: 9pt; }
      .signature-section > p { margin-bottom: 1mm; }
      .signature-table { border-collapse: collapse; font-size: 9pt; }
      .signature-table th, .signature-table td { border: 1px solid #333; padding: 0.5mm 1.5mm; }
      .signature-table th { background: #f0f0f0; font-weight: bold; white-space: nowrap; }
      .signature-table .handwrite { min-width: 180px; }
      .seal { width: 2.2em; height: 2.2em; text-align: center; vertical-align: middle; font-size: 8.5pt; border: 1px solid #333; }
      .company-section { display: flex; justify-content: space-between; align-items: flex-end; margin: 1.5mm 0; font-size: 9pt; }
      .company-info p { margin-bottom: 0; }
      .staff-info { display: flex; align-items: center; }
      .legal-section { margin: 1.5mm 0; }
      .legal-section > p:first-child { font-size: 9pt; margin-bottom: 0.5mm; }
      .small-text { font-size: 7.5pt; line-height: 1.3; }
      .cooling-off-section { margin: 1.5mm 0; border: 2px solid #cc0000; padding: 1.5mm 2mm; color: #cc0000; }
      .cooling-off-title { font-size: 9.5pt; font-weight: bold; margin-bottom: 0.5mm; color: #cc0000; }
      .cooling-off-body { font-size: 8pt; line-height: 1.3; color: #cc0000; }
      .cooling-off-body p { margin-bottom: 0.5mm; }
      .page-back .contract-title { margin-bottom: 2mm; }
      .terms-columns { display: flex; gap: 5mm; }
      .terms-col { flex: 1; }
      .term-article { margin-bottom: 1.2mm; }
      .term-article h3 { font-size: 8.5pt; font-weight: bold; margin-bottom: 0.3mm; }
      .term-article p { font-size: 7.5pt; line-height: 1.3; margin-bottom: 0.5mm; }
      @media print {
        body { background: #fff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        aside, header, .no-print { display: none !important; }
        main { margin-left: 0 !important; }
        main > div { padding: 0 !important; }
        .contract-sheet { width: 100%; height: auto; max-height: 410mm; margin: 0; padding: 8mm 12mm; box-shadow: none; page-break-after: always; overflow: hidden; }
        .contract-sheet:last-child { page-break-after: auto; }
        @page { size: A3 portrait; margin: 5mm; }
      }
    `}</style>
  )
}

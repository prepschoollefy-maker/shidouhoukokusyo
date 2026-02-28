'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Lock, Loader2, Save, Printer } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useDashboardAuth } from '@/hooks/use-dashboard-auth'
import { getGradeColor } from '@/lib/grade-utils'
import { toast } from 'sonner'
import Link from 'next/link'

interface Student {
  id: string
  name: string
  student_number: string | null
  grade: string | null
  direct_debit_start_ym: string | null
  payment_method: string | null
}

interface CourseEntry {
  course: string
  lessons: number
}

interface Contract {
  id: string
  start_date: string
  end_date: string
  grade: string
  courses: CourseEntry[]
  monthly_amount: number
  notes: string
  campaign: string | null
}

interface LectureAllocation {
  year: number
  month: number
  lessons: number
}

interface LectureCourse {
  course: string
  total_lessons: number
  unit_price: number
  subtotal: number
  allocation: LectureAllocation[]
}

interface Lecture {
  id: string
  label: string
  grade: string
  courses: LectureCourse[]
  total_amount: number
  notes: string
}

interface MaterialSale {
  id: string
  item_name: string
  unit_price: number
  quantity: number
  total_amount: number
  sale_date: string
  billing_year: number
  billing_month: number
  notes: string
}

export default function StudentContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { authenticated, password, setPassword, storedPw, verifying, initializing, handleAuth: authHandler } = useDashboardAuth()

  const [student, setStudent] = useState<Student | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [materials, setMaterials] = useState<MaterialSale[]>([])
  const [loading, setLoading] = useState(true)

  // 口座振替開始年月の編集
  const [directDebitStartYm, setDirectDebitStartYm] = useState('')
  const [savingDebit, setSavingDebit] = useState(false)

  const handleAuth = () => authHandler('/api/contracts')

  const fetchData = useCallback(async () => {
    if (!storedPw) return
    const pw = encodeURIComponent(storedPw)
    const [studentRes, contractsRes, lecturesRes, materialsRes] = await Promise.all([
      fetch(`/api/students/${id}`),
      fetch(`/api/contracts?student_id=${id}&pw=${pw}`),
      fetch(`/api/lectures?student_id=${id}&pw=${pw}`),
      fetch(`/api/materials?student_id=${id}&pw=${pw}`),
    ])
    if (studentRes.ok) {
      const json = await studentRes.json()
      setStudent(json.data || null)
      setDirectDebitStartYm(json.data?.direct_debit_start_ym || '')
    }
    if (contractsRes.ok) {
      const json = await contractsRes.json()
      setContracts(json.data || [])
    }
    if (lecturesRes.ok) {
      const json = await lecturesRes.json()
      setLectures(json.data || [])
    }
    if (materialsRes.ok) {
      const json = await materialsRes.json()
      setMaterials(json.data || [])
    }
  }, [id, storedPw])

  useEffect(() => {
    if (!authenticated || initializing) return
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [authenticated, initializing, fetchData])

  const handleSaveDirectDebit = async () => {
    setSavingDebit(true)
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direct_debit_start_ym: directDebitStartYm || null }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      const json = await res.json()
      setStudent(prev => prev ? { ...prev, direct_debit_start_ym: json.data?.direct_debit_start_ym || null } : prev)
      toast.success('口座振替開始年月を保存しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存に失敗しました')
    } finally {
      setSavingDebit(false)
    }
  }

  /** 現在の支払方法を表示用に算出 */
  const getCurrentPaymentMethod = (): '振込' | '口座振替' => {
    if (!student?.direct_debit_start_ym) return (student?.payment_method as '振込' | '口座振替') || '振込'
    const now = new Date()
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return currentYm >= student.direct_debit_start_ym ? '口座振替' : '振込'
  }

  const formatYen = (n: number) => `¥${n.toLocaleString()}`
  const formatCourses = (courses: CourseEntry[]) =>
    courses.map(c => `${c.course}(週${c.lessons})`).join(', ')
  const formatLectureCourses = (courses: LectureCourse[]) =>
    courses.map(c => `${c.course} ${c.total_lessons}コマ`).join(', ')

  if (initializing) return <LoadingSpinner />
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-bold">生徒契約詳細</h2>
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

  // 契約を開始日降順（新しい順）にソート
  const sortedContracts = [...contracts].sort((a, b) => b.start_date.localeCompare(a.start_date))
  const sortedLectures = [...lectures].sort((a, b) => (b.label || '').localeCompare(a.label || ''))
  const sortedMaterials = [...materials].sort((a, b) => b.sale_date.localeCompare(a.sale_date))

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <Link
          href="/admin/contracts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          通常コース管理に戻る
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{student?.name || '不明'}</h2>
          {student?.grade && (
            <span className={`text-sm px-2 py-0.5 rounded-full ${getGradeColor(student.grade)}`}>
              {student.grade}
            </span>
          )}
          {student?.student_number && (
            <span className="text-sm text-muted-foreground">
              塾生番号: {student.student_number}
            </span>
          )}
        </div>
      </div>

      {/* 支払方法設定 */}
      <Card>
        <CardContent className="py-4 px-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">支払方法</h3>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm">現在:</span>
              {getCurrentPaymentMethod() === '口座振替'
                ? <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50">口座振替</Badge>
                : <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">振込</Badge>
              }
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="debit-start" className="text-sm whitespace-nowrap">口座振替開始年月</Label>
              <Input
                id="debit-start"
                type="month"
                value={directDebitStartYm}
                onChange={(e) => setDirectDebitStartYm(e.target.value)}
                className="w-44"
              />
              <Button
                size="sm"
                onClick={handleSaveDirectDebit}
                disabled={savingDebit || directDebitStartYm === (student?.direct_debit_start_ym || '')}
              >
                {savingDebit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
              {directDebitStartYm && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => { setDirectDebitStartYm(''); }}
                >
                  解除
                </Button>
              )}
            </div>
          </div>
          {directDebitStartYm && (
            <p className="text-xs text-muted-foreground mt-2">
              {directDebitStartYm} 以降の請求は口座振替、それより前は振込として扱われます
            </p>
          )}
        </CardContent>
      </Card>

      {/* 通常コース */}
      <div>
        <h3 className="text-lg font-semibold mb-3">通常コース</h3>
        {sortedContracts.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground text-sm">
              通常コースの登録がありません
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sortedContracts.map(c => (
              <Card key={c.id} className={c.end_date < today ? 'opacity-60' : ''}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      {c.start_date} ~ {c.end_date}
                    </span>
                    {c.end_date >= today ? (
                      <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">有効</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">期限切れ</span>
                    )}
                    {c.campaign && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">{c.campaign}</span>
                    )}
                    <span className="font-medium">{formatCourses(c.courses)}</span>
                    <span className="font-mono font-bold">{formatYen(c.monthly_amount)}</span>
                    {c.notes && <span className="text-sm text-muted-foreground">({c.notes})</span>}
                    <Link href={`/admin/contracts/print/${c.id}`} target="_blank">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground">
                        <Printer className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs">印刷</span>
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 講習 */}
      <div>
        <h3 className="text-lg font-semibold mb-3">講習</h3>
        {sortedLectures.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground text-sm">
              講習の登録がありません
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sortedLectures.map(l => (
              <Card key={l.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium">{l.label}</span>
                    <span className="text-sm">{formatLectureCourses(l.courses)}</span>
                    <span className="font-mono font-bold">{formatYen(l.total_amount)}</span>
                    {l.notes && <span className="text-sm text-muted-foreground">({l.notes})</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 教材販売 */}
      <div>
        <h3 className="text-lg font-semibold mb-3">教材販売</h3>
        {sortedMaterials.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground text-sm">
              教材販売の記録がありません
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sortedMaterials.map(m => (
              <Card key={m.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium">{m.item_name}</span>
                    <span className="text-sm">{m.quantity}冊</span>
                    <span className="font-mono font-bold">{formatYen(m.total_amount)}</span>
                    <span className="text-sm text-muted-foreground">{m.sale_date}</span>
                    <span className="text-sm text-muted-foreground">請求: {m.billing_year}/{m.billing_month}月</span>
                    {m.notes && <span className="text-sm text-muted-foreground">({m.notes})</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

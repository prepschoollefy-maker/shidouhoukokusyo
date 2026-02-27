'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Lock } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useDashboardAuth } from '@/hooks/use-dashboard-auth'
import { getGradeColor } from '@/lib/grade-utils'
import Link from 'next/link'

interface Student {
  id: string
  name: string
  student_number: string | null
  grade: string | null
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

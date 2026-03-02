'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, RefreshCw, Check } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { toast } from 'sonner'
import { GRADES, COURSES, calcMonthlyAmount, type CourseEntry } from '@/lib/contracts/pricing'
import { useContractAuth } from '../layout'

interface Student {
  id: string
  name: string
  student_number: string | null
}

interface ExpiringContract {
  id: string
  student_id: string
  grade: string
  courses: CourseEntry[]
  start_date: string
  end_date: string
  monthly_amount: number
  student: Student
  defaults: {
    new_grade: string
    new_courses: CourseEntry[]
    new_start_date: string
    new_end_date: string
  }
}

interface RowState {
  newGrade: string
  newCourses: CourseEntry[]
  newStartDate: string
  newEndDate: string
  renewed: boolean
  renewing: boolean
  newMonthlyAmount: number | null
}

export default function ContractsRenewPage() {
  const { storedPw } = useContractAuth()

  // 年度ロジック
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const fy = month >= 4 ? year : year - 1

  const [contracts, setContracts] = useState<ExpiringContract[]>([])
  const [loading, setLoading] = useState(false)
  const [endFrom, setEndFrom] = useState(`${fy + 1}-01-31`)
  const [endTo, setEndTo] = useState(`${fy + 1}-03-31`)
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})

  const fetchExpiring = useCallback(async () => {
    if (!storedPw) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        pw: storedPw,
        end_from: endFrom,
        end_to: endTo,
      })
      const res = await fetch(`/api/contracts/expiring?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'データ取得に失敗しました')
      }
      const json = await res.json()
      const items: ExpiringContract[] = json.data || []
      setContracts(items)

      // 初期rowState
      const states: Record<string, RowState> = {}
      for (const c of items) {
        states[c.id] = {
          newGrade: c.defaults.new_grade,
          newCourses: c.defaults.new_courses.length > 0
            ? c.defaults.new_courses
            : [{ course: '', lessons: 1 }],
          newStartDate: c.defaults.new_start_date,
          newEndDate: c.defaults.new_end_date,
          renewed: false,
          renewing: false,
          newMonthlyAmount: null,
        }
      }
      setRowStates(states)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [storedPw, endFrom, endTo])

  useEffect(() => {
    if (storedPw) fetchExpiring()
  }, [storedPw]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = (id: string, update: Partial<RowState>) => {
    setRowStates(prev => ({ ...prev, [id]: { ...prev[id], ...update } }))
  }

  const updateRowCourse = (id: string, index: number, field: keyof CourseEntry, value: string | number) => {
    setRowStates(prev => {
      const row = prev[id]
      const newCourses = row.newCourses.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      )
      return { ...prev, [id]: { ...row, newCourses } }
    })
  }

  // リアルタイム月謝プレビュー
  const getPreviewAmount = (row: RowState): number | null => {
    const validCourses = row.newCourses.filter(c => c.course && c.lessons > 0)
    if (!row.newGrade || validCourses.length === 0) return null
    return calcMonthlyAmount(row.newGrade, validCourses)
  }

  const handleRenew = async (contractId: string) => {
    const row = rowStates[contractId]
    if (!row || row.renewed || row.renewing) return

    const validCourses = row.newCourses.filter(c => c.course && c.lessons > 0)
    if (validCourses.length === 0) {
      toast.error('コースを1つ以上設定してください')
      return
    }

    updateRow(contractId, { renewing: true })

    try {
      const res = await fetch('/api/contracts/renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dashboard-pw': storedPw,
        },
        body: JSON.stringify({
          contract_id: contractId,
          new_grade: row.newGrade,
          new_courses: validCourses,
          new_start_date: row.newStartDate,
          new_end_date: row.newEndDate,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || '更新に失敗しました')
      }

      const json = await res.json()
      updateRow(contractId, {
        renewed: true,
        renewing: false,
        newMonthlyAmount: json.monthly_amount,
      })
      toast.success('更新しました')
    } catch (error) {
      updateRow(contractId, { renewing: false })
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    }
  }

  const formatYen = (n: number) => `¥${n.toLocaleString()}`
  const formatCourses = (courses: CourseEntry[]) =>
    courses.map(c => `${c.course}(週${c.lessons})`).join(', ')

  const activeCount = useMemo(() =>
    contracts.filter(c => !rowStates[c.id]?.renewed).length,
    [contracts, rowStates]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">一括更新</h2>
      </div>

      {/* フィルター */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">終了日FROM</Label>
              <Input
                type="date"
                value={endFrom}
                onChange={(e) => setEndFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">終了日TO</Label>
              <Input
                type="date"
                value={endTo}
                onChange={(e) => setEndTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={fetchExpiring} disabled={loading}>
              <Search className="h-4 w-4 mr-1" />
              検索
            </Button>
            {contracts.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                {contracts.length}件の終了予定契約
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && <LoadingSpinner />}

      {!loading && contracts.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            該当する契約がありません
          </CardContent>
        </Card>
      )}

      {!loading && contracts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 whitespace-nowrap">塾生No.</th>
                <th className="text-left p-2 whitespace-nowrap">氏名</th>
                <th className="text-left p-2 whitespace-nowrap">現学年</th>
                <th className="text-left p-2 whitespace-nowrap">現コース</th>
                <th className="text-left p-2 whitespace-nowrap">契約終了日</th>
                <th className="p-2"></th>
                <th className="text-left p-2 whitespace-nowrap">新学年</th>
                <th className="text-left p-2 whitespace-nowrap">新コース1</th>
                <th className="text-left p-2 whitespace-nowrap">コマ</th>
                <th className="text-left p-2 whitespace-nowrap">新コース2</th>
                <th className="text-left p-2 whitespace-nowrap">コマ</th>
                <th className="text-left p-2 whitespace-nowrap">新開始日</th>
                <th className="text-left p-2 whitespace-nowrap">新終了日</th>
                <th className="text-left p-2 whitespace-nowrap">月謝</th>
                <th className="p-2 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const row = rowStates[c.id]
                if (!row) return null

                const preview = row.renewed
                  ? row.newMonthlyAmount
                  : getPreviewAmount(row)

                return (
                  <tr
                    key={c.id}
                    className={`border-b ${row.renewed ? 'bg-green-50 opacity-70' : 'hover:bg-muted/30'}`}
                  >
                    {/* 現在の契約（読み取り専用） */}
                    <td className="p-2 whitespace-nowrap font-mono text-xs">
                      {c.student?.student_number || '-'}
                    </td>
                    <td className="p-2 whitespace-nowrap">{c.student?.name || '-'}</td>
                    <td className="p-2 whitespace-nowrap">{c.grade}</td>
                    <td className="p-2 whitespace-nowrap text-xs">{formatCourses(c.courses)}</td>
                    <td className="p-2 whitespace-nowrap">{c.end_date}</td>

                    {/* 矢印 */}
                    <td className="p-2 text-center text-muted-foreground">→</td>

                    {/* 新しい契約（編集可能） */}
                    <td className="p-2">
                      <Select
                        value={row.newGrade}
                        onValueChange={(v) => updateRow(c.id, { newGrade: v })}
                        disabled={row.renewed}
                      >
                        <SelectTrigger className="w-20 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GRADES.map(g => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* コース1 */}
                    <td className="p-2">
                      <Select
                        value={row.newCourses[0]?.course || ''}
                        onValueChange={(v) => updateRowCourse(c.id, 0, 'course', v)}
                        disabled={row.renewed}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                          {COURSES.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={1}
                        max={7}
                        value={row.newCourses[0]?.lessons || 1}
                        onChange={(e) => updateRowCourse(c.id, 0, 'lessons', parseInt(e.target.value) || 1)}
                        disabled={row.renewed}
                        className="w-14 h-8 text-xs"
                      />
                    </td>

                    {/* コース2 */}
                    <td className="p-2">
                      <Select
                        value={row.newCourses[1]?.course || '_none'}
                        onValueChange={(v) => {
                          if (v === '_none') {
                            // コース2を削除
                            setRowStates(prev => ({
                              ...prev,
                              [c.id]: {
                                ...prev[c.id],
                                newCourses: [prev[c.id].newCourses[0]],
                              },
                            }))
                          } else {
                            if (row.newCourses.length < 2) {
                              setRowStates(prev => ({
                                ...prev,
                                [c.id]: {
                                  ...prev[c.id],
                                  newCourses: [...prev[c.id].newCourses, { course: v, lessons: 1 }],
                                },
                              }))
                            } else {
                              updateRowCourse(c.id, 1, 'course', v)
                            }
                          }
                        }}
                        disabled={row.renewed}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">-</SelectItem>
                          {COURSES.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      {row.newCourses.length >= 2 && (
                        <Input
                          type="number"
                          min={1}
                          max={7}
                          value={row.newCourses[1]?.lessons || 1}
                          onChange={(e) => updateRowCourse(c.id, 1, 'lessons', parseInt(e.target.value) || 1)}
                          disabled={row.renewed}
                          className="w-14 h-8 text-xs"
                        />
                      )}
                    </td>

                    {/* 日付 */}
                    <td className="p-2">
                      <Input
                        type="date"
                        value={row.newStartDate}
                        onChange={(e) => updateRow(c.id, { newStartDate: e.target.value })}
                        disabled={row.renewed}
                        className="w-36 h-8 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="date"
                        value={row.newEndDate}
                        onChange={(e) => updateRow(c.id, { newEndDate: e.target.value })}
                        disabled={row.renewed}
                        className="w-36 h-8 text-xs"
                      />
                    </td>

                    {/* 月謝プレビュー */}
                    <td className="p-2 whitespace-nowrap font-mono text-xs">
                      {preview != null ? formatYen(preview) : '-'}
                    </td>

                    {/* 操作 */}
                    <td className="p-2 text-center">
                      {row.renewed ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                          <Check className="h-4 w-4" />
                          済
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleRenew(c.id)}
                          disabled={row.renewing}
                          className="h-8 text-xs"
                        >
                          <RefreshCw className={`h-3 w-3 mr-1 ${row.renewing ? 'animate-spin' : ''}`} />
                          {row.renewing ? '処理中' : '更新'}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

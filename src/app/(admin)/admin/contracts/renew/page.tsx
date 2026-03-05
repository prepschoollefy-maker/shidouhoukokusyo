'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

    if (!row.newStartDate || !row.newEndDate) {
      toast.error('期間を入力してください')
      return
    }
    if (row.newStartDate > row.newEndDate) {
      toast.error('開始日が終了日より後になっています')
      return
    }
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
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>塾生No.</TableHead>
                  <TableHead>氏名</TableHead>
                  <TableHead>現在</TableHead>
                  <TableHead className="text-center w-8"></TableHead>
                  <TableHead>新学年</TableHead>
                  <TableHead>新コース（各コース＋週コマ数）</TableHead>
                  <TableHead>新期間</TableHead>
                  <TableHead className="text-right">月謝</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => {
                  const row = rowStates[c.id]
                  if (!row) return null

                  const preview = row.renewed
                    ? row.newMonthlyAmount
                    : getPreviewAmount(row)

                  return (
                    <TableRow
                      key={c.id}
                      className={row.renewed ? 'bg-green-50 opacity-70' : ''}
                    >
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {c.student?.student_number || '-'}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{c.student?.name || '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div>{c.grade} / {formatCourses(c.courses)}</div>
                        <div>〜{c.end_date}</div>
                      </TableCell>

                      <TableCell className="text-center text-muted-foreground">→</TableCell>

                      <TableCell>
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
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {/* コース1 */}
                          <div className="flex items-center gap-1">
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
                            <Input
                              type="number" min={1} max={7}
                              value={row.newCourses[0]?.lessons || 1}
                              onChange={(e) => updateRowCourse(c.id, 0, 'lessons', parseInt(e.target.value) || 1)}
                              disabled={row.renewed}
                              className="w-14 h-8 text-xs"
                            />
                          </div>
                          {/* コース2 */}
                          <div className="flex items-center gap-1">
                            <Select
                              value={row.newCourses[1]?.course || '_none'}
                              onValueChange={(v) => {
                                if (v === '_none') {
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
                            {row.newCourses.length >= 2 && (
                              <Input
                                type="number" min={1} max={7}
                                value={row.newCourses[1]?.lessons || 1}
                                onChange={(e) => updateRowCourse(c.id, 1, 'lessons', parseInt(e.target.value) || 1)}
                                disabled={row.renewed}
                                className="w-14 h-8 text-xs"
                              />
                            )}
                          </div>
                          {/* コース3 */}
                          {(row.newCourses.length >= 2) && (
                            <div className="flex items-center gap-1">
                              <Select
                                value={row.newCourses[2]?.course || '_none'}
                                onValueChange={(v) => {
                                  if (v === '_none') {
                                    setRowStates(prev => ({
                                      ...prev,
                                      [c.id]: {
                                        ...prev[c.id],
                                        newCourses: prev[c.id].newCourses.slice(0, 2),
                                      },
                                    }))
                                  } else {
                                    if (row.newCourses.length < 3) {
                                      setRowStates(prev => ({
                                        ...prev,
                                        [c.id]: {
                                          ...prev[c.id],
                                          newCourses: [...prev[c.id].newCourses, { course: v, lessons: 1 }],
                                        },
                                      }))
                                    } else {
                                      updateRowCourse(c.id, 2, 'course', v)
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
                              {row.newCourses.length >= 3 && (
                                <Input
                                  type="number" min={1} max={7}
                                  value={row.newCourses[2]?.lessons || 1}
                                  onChange={(e) => updateRowCourse(c.id, 2, 'lessons', parseInt(e.target.value) || 1)}
                                  disabled={row.renewed}
                                  className="w-14 h-8 text-xs"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Input
                            type="date"
                            value={row.newStartDate}
                            onChange={(e) => updateRow(c.id, { newStartDate: e.target.value })}
                            disabled={row.renewed}
                            className="w-32 h-8 text-xs"
                          />
                          <Input
                            type="date"
                            value={row.newEndDate}
                            onChange={(e) => updateRow(c.id, { newEndDate: e.target.value })}
                            disabled={row.renewed}
                            className="w-32 h-8 text-xs"
                          />
                        </div>
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap font-mono text-sm">
                        {preview != null ? formatYen(preview) : '-'}
                      </TableCell>

                      <TableCell className="text-center">
                        {row.renewed ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                            <Check className="h-4 w-4" />済
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
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

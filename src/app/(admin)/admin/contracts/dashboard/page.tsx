'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Download } from 'lucide-react'
import { useContractAuth } from '../layout'

interface MonthData {
  year: number
  month: number
  revenue: number
  contractRevenue: number
  lectureRevenue: number
  materialRevenue: number
  count: number
}

interface GradeStat {
  grade: string
  student_count: number
  monthly_revenue: number
  weekly_lessons: number
}

interface LectureStat {
  label: string
  student_count: number
  total_lessons: number
  revenue: number
}

interface MaterialStat {
  item_name: string
  unit_price: number
  quantity: number
  revenue: number
}

export default function ContractDashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [months, setMonths] = useState<MonthData[]>([])
  const [gradeStats, setGradeStats] = useState<GradeStat[]>([])
  const [totalGradeStudents, setTotalGradeStudents] = useState(0)
  const [totalGradeRevenue, setTotalGradeRevenue] = useState(0)
  const [totalGradeLessons, setTotalGradeLessons] = useState(0)
  const [lectureStats, setLectureStats] = useState<LectureStat[]>([])
  const [totalLectureStudents, setTotalLectureStudents] = useState(0)
  const [totalLectureLessons, setTotalLectureLessons] = useState(0)
  const [totalLectureRevenue, setTotalLectureRevenue] = useState(0)
  const [materialStats, setMaterialStats] = useState<MaterialStat[]>([])
  const [totalMaterialQuantity, setTotalMaterialQuantity] = useState(0)
  const [totalMaterialRevenue, setTotalMaterialRevenue] = useState(0)
  const [loading, setLoading] = useState(false)

  const { storedPw } = useContractAuth()

  useEffect(() => {
    if (!storedPw) return
    const fetchSummary = async () => {
      setLoading(true)
      const res = await fetch(`/api/contracts/summary?year=${year}&month=${month}&pw=${encodeURIComponent(storedPw)}`)
      if (res.ok) {
        const json = await res.json()
        setMonths(json.data || [])
        setGradeStats(json.gradeStats || [])
        setTotalGradeStudents(json.totalGradeStudents || 0)
        setTotalGradeRevenue(json.totalGradeRevenue || 0)
        setTotalGradeLessons(json.totalGradeLessons || 0)
        setLectureStats(json.lectureStats || [])
        setTotalLectureStudents(json.totalLectureStudents || 0)
        setTotalLectureLessons(json.totalLectureLessons || 0)
        setTotalLectureRevenue(json.totalLectureRevenue || 0)
        setMaterialStats(json.materialStats || [])
        setTotalMaterialQuantity(json.totalMaterialQuantity || 0)
        setTotalMaterialRevenue(json.totalMaterialRevenue || 0)
      }
      setLoading(false)
    }
    fetchSummary()
  }, [year, month, storedPw])

  const formatYen = (n: number) => `¥${n.toLocaleString()}`
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)

  const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

  const exportCsv = (tab: 'regular' | 'lecture' | 'material') => {
    let header = ''
    let rows: string[] = []
    let filename = ''
    const prefix = `${year}年${month}月`

    if (tab === 'regular') {
      header = '学年,生徒数,月額売上,週コマ数'
      rows = gradeStats.map(g => [csvCell(g.grade), g.student_count, g.monthly_revenue, g.weekly_lessons].join(','))
      rows.push([csvCell('合計'), totalGradeStudents, totalGradeRevenue, totalGradeLessons].join(','))
      filename = `${prefix}_通常コース統計.csv`
    } else if (tab === 'lecture') {
      header = 'ラベル,生徒数,コマ数,売上'
      rows = lectureStats.map(l => [csvCell(l.label), l.student_count, l.total_lessons, l.revenue].join(','))
      rows.push([csvCell('合計'), totalLectureStudents, totalLectureLessons, totalLectureRevenue].join(','))
      filename = `${prefix}_講習統計.csv`
    } else {
      header = '商品名,単価,数量,売上'
      rows = materialStats.map(m => [csvCell(m.item_name), m.unit_price, m.quantity, m.revenue].join(','))
      rows.push([csvCell('合計'), '', totalMaterialQuantity, totalMaterialRevenue].join(','))
      filename = `${prefix}_教材販売統計.csv`
    }

    const csv = '\uFEFF' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // 当月データ（配列の最後）
  const current = months.length > 0 ? months[months.length - 1] : null
  const currentRevenue = current?.revenue || 0
  const currentCount = current?.count || 0
  const avgMonthly = currentCount > 0 ? Math.floor(currentRevenue / currentCount) : 0

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">経営ダッシュボード</h2>
        <div className="flex gap-2 items-center">
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m} value={String(m)}>{m}月</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">当月売上</div>
            <div className="text-3xl font-bold mt-1">{formatYen(currentRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">生徒数</div>
            <div className="text-3xl font-bold mt-1">{currentCount}<span className="text-lg ml-1">人</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">平均月謝</div>
            <div className="text-3xl font-bold mt-1">{formatYen(avgMonthly)}</div>
          </CardContent>
        </Card>
      </div>

      {/* 月別売上推移グラフ（積み上げ棒グラフ） */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">月別売上推移（12ヶ月）</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-400" />通常コース</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />講習</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-400" />教材販売</span>
            </div>
          </div>
          {(() => {
            const rawMax = Math.max(...months.map(m => m.revenue), 1)
            const step = rawMax <= 500000 ? 100000
              : rawMax <= 1000000 ? 200000
              : rawMax <= 2000000 ? 500000
              : rawMax <= 5000000 ? 1000000
              : 2000000
            const gridMax = Math.ceil(rawMax / step) * step
            const gridLines = Array.from({ length: Math.ceil(gridMax / step) + 1 }, (_, i) => i * step)
            const chartHeight = 220

            const formatAmount = (n: number) => {
              if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`
              return n.toLocaleString()
            }

            return (
              <div className="flex">
                <div className="flex flex-col justify-between pr-2 text-right" style={{ height: `${chartHeight}px`, width: '48px' }}>
                  {[...gridLines].reverse().map((v, i) => (
                    <div key={i} className="text-xs text-muted-foreground leading-none whitespace-nowrap">
                      {formatAmount(v)}
                    </div>
                  ))}
                </div>
                <div className="flex-1 relative" style={{ height: `${chartHeight}px` }}>
                  {gridLines.map((v, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-gray-200"
                      style={{ bottom: `${(v / gridMax) * 100}%` }}
                    />
                  ))}
                  <div className="absolute inset-0 flex items-end gap-1 px-1">
                    {months.map((m, i) => {
                      const totalH = gridMax > 0 ? (m.revenue / gridMax) * chartHeight : 0
                      const contractH = gridMax > 0 ? (m.contractRevenue / gridMax) * chartHeight : 0
                      const lectureH = gridMax > 0 ? (m.lectureRevenue / gridMax) * chartHeight : 0
                      const materialH = gridMax > 0 ? (m.materialRevenue / gridMax) * chartHeight : 0
                      const isCurrent = i === months.length - 1
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                          <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                            <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                              <div className="font-semibold border-b border-gray-600 pb-0.5 mb-0.5">合計 ¥{m.revenue.toLocaleString()}</div>
                              {m.contractRevenue > 0 && <div className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-400" />通常 ¥{m.contractRevenue.toLocaleString()}</div>}
                              {m.lectureRevenue > 0 && <div className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-400" />講習 ¥{m.lectureRevenue.toLocaleString()}</div>}
                              {m.materialRevenue > 0 && <div className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-emerald-400" />教材 ¥{m.materialRevenue.toLocaleString()}</div>}
                              <div className="text-gray-300 mt-0.5">{m.count}人</div>
                            </div>
                          </div>
                          {isCurrent && m.revenue > 0 && (
                            <div className="text-xs font-semibold text-blue-600 mb-1 whitespace-nowrap">
                              ¥{m.revenue.toLocaleString()}
                            </div>
                          )}
                          <div
                            className={`w-full max-w-[40px] flex flex-col-reverse rounded-t overflow-hidden ${isCurrent ? 'ring-2 ring-blue-500/30' : ''}`}
                            style={{ height: `${Math.max(totalH, m.revenue > 0 ? 4 : 2)}px` }}
                          >
                            <div className={`w-full ${isCurrent ? 'bg-blue-500' : 'bg-blue-400'}`} style={{ height: contractH > 0 ? `${contractH}px` : '0' }} />
                            <div className={`w-full ${isCurrent ? 'bg-amber-500' : 'bg-amber-400'}`} style={{ height: lectureH > 0 ? `${lectureH}px` : '0' }} />
                            <div className={`w-full ${isCurrent ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ height: materialH > 0 ? `${materialH}px` : '0' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
          <div className="flex mt-1" style={{ marginLeft: '48px' }}>
            <div className="flex-1 flex gap-1 px-1">
              {months.map((m, i) => {
                const isCurrent = i === months.length - 1
                return (
                  <div key={i} className="flex-1 text-center">
                    <div className={`text-xs ${isCurrent ? 'font-bold text-blue-600' : 'text-muted-foreground'}`}>
                      {m.month}月
                    </div>
                    <div className={`text-xs mt-0.5 ${isCurrent ? 'font-semibold' : 'text-muted-foreground'}`}>
                      {m.count}人
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 統計タブ */}
      <Card>
        <CardContent className="p-4">
          <Tabs defaultValue="regular">
            <div className="flex items-center justify-between mb-3">
              <TabsList>
                <TabsTrigger value="regular">通常コース</TabsTrigger>
                <TabsTrigger value="lecture">講習</TabsTrigger>
                <TabsTrigger value="material">教材販売</TabsTrigger>
              </TabsList>
            </div>

            {/* 通常コース */}
            <TabsContent value="regular">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">学年別統計（{year}年{month}月）</h3>
                <Button variant="outline" size="sm" onClick={() => exportCsv('regular')} disabled={gradeStats.length === 0}>
                  <Download className="size-4 mr-1" />CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>学年</TableHead>
                      <TableHead className="text-right">生徒数</TableHead>
                      <TableHead className="text-right">月額売上</TableHead>
                      <TableHead className="text-right">週コマ数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradeStats.map(g => (
                      <TableRow key={g.grade}>
                        <TableCell className="font-medium">{g.grade}</TableCell>
                        <TableCell className="text-right">{g.student_count}人</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(g.monthly_revenue)}</TableCell>
                        <TableCell className="text-right">{g.weekly_lessons}コマ</TableCell>
                      </TableRow>
                    ))}
                    {gradeStats.length > 0 && (
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>合計</TableCell>
                        <TableCell className="text-right">{totalGradeStudents}人</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(totalGradeRevenue)}</TableCell>
                        <TableCell className="text-right">{totalGradeLessons}コマ</TableCell>
                      </TableRow>
                    )}
                    {gradeStats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">データなし</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* 講習 */}
            <TabsContent value="lecture">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">ラベル別統計（{year}年{month}月）</h3>
                <Button variant="outline" size="sm" onClick={() => exportCsv('lecture')} disabled={lectureStats.length === 0}>
                  <Download className="size-4 mr-1" />CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ラベル</TableHead>
                      <TableHead className="text-right">生徒数</TableHead>
                      <TableHead className="text-right">コマ数</TableHead>
                      <TableHead className="text-right">売上</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lectureStats.map(l => (
                      <TableRow key={l.label}>
                        <TableCell className="font-medium">{l.label}</TableCell>
                        <TableCell className="text-right">{l.student_count}人</TableCell>
                        <TableCell className="text-right">{l.total_lessons}コマ</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(l.revenue)}</TableCell>
                      </TableRow>
                    ))}
                    {lectureStats.length > 0 && (
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>合計</TableCell>
                        <TableCell className="text-right">{totalLectureStudents}人</TableCell>
                        <TableCell className="text-right">{totalLectureLessons}コマ</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(totalLectureRevenue)}</TableCell>
                      </TableRow>
                    )}
                    {lectureStats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">データなし</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* 教材販売 */}
            <TabsContent value="material">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">商品別統計（{year}年{month}月）</h3>
                <Button variant="outline" size="sm" onClick={() => exportCsv('material')} disabled={materialStats.length === 0}>
                  <Download className="size-4 mr-1" />CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品名</TableHead>
                      <TableHead className="text-right">単価</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">売上</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialStats.map(m => (
                      <TableRow key={m.item_name}>
                        <TableCell className="font-medium">{m.item_name}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(m.unit_price)}</TableCell>
                        <TableCell className="text-right">{m.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(m.revenue)}</TableCell>
                      </TableRow>
                    ))}
                    {materialStats.length > 0 && (
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>合計</TableCell>
                        <TableCell className="text-right" />
                        <TableCell className="text-right">{totalMaterialQuantity}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(totalMaterialRevenue)}</TableCell>
                      </TableRow>
                    )}
                    {materialStats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">データなし</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 月別詳細テーブル */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">月別詳細</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">月</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">売上合計</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">通常</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">講習</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">教材</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">生徒数</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">前月比</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => {
                  const prev = i > 0 ? months[i - 1] : null
                  const diff = prev ? m.revenue - prev.revenue : 0
                  const isCurrent = i === months.length - 1
                  return (
                    <tr key={i} className={`border-b last:border-b-0 ${isCurrent ? 'bg-blue-50' : ''}`}>
                      <td className={`py-2 px-2 ${isCurrent ? 'font-bold' : ''}`}>{m.year}/{m.month}月</td>
                      <td className="py-2 px-2 text-right font-medium">¥{m.revenue.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{m.contractRevenue > 0 ? `¥${m.contractRevenue.toLocaleString()}` : '—'}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{m.lectureRevenue > 0 ? `¥${m.lectureRevenue.toLocaleString()}` : '—'}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{m.materialRevenue > 0 ? `¥${m.materialRevenue.toLocaleString()}` : '—'}</td>
                      <td className="py-2 px-2 text-right">{m.count}人</td>
                      <td className={`py-2 px-2 text-right ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : ''}`}>
                        {prev ? (diff > 0 ? '+' : '') + `¥${diff.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

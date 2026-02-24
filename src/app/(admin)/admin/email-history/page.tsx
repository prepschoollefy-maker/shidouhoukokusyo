'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { PaginationControl } from '@/components/ui/pagination-control'
import { Mail, Search } from 'lucide-react'

interface EmailLogEntry {
  id: string
  summary_id: string | null
  to_email: string
  subject: string
  status: string
  sent_at: string | null
  error_message: string | null
  created_at: string
  student_id: string
}

type EmailType = 'all' | 'report' | 'mendan'

const PER_PAGE = 20

export default function EmailHistoryPage() {
  const [logs, setLogs] = useState<EmailLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<EmailType>('all')
  const supabase = createClient()

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      setLogs(data || [])
      setLoading(false)
    }
    fetchLogs()
  }, [supabase])

  const filtered = useMemo(() => {
    let result = logs

    // Type filter
    if (typeFilter === 'report') {
      result = result.filter(l => l.summary_id !== null)
    } else if (typeFilter === 'mendan') {
      result = result.filter(l => l.summary_id === null)
    }

    // Search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.to_email.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q)
      )
    }

    return result
  }, [logs, search, typeFilter])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleTypeChange = (value: string) => {
    setTypeFilter(value as EmailType)
    setPage(1)
  }

  // Counts
  const reportCount = logs.filter(l => l.summary_id !== null).length
  const mendanCount = logs.filter(l => l.summary_id === null).length

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">メール送信履歴</h2>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={typeFilter} onValueChange={handleTypeChange}>
          <TabsList>
            <TabsTrigger value="all">すべて ({logs.length})</TabsTrigger>
            <TabsTrigger value="report">授業レポート ({reportCount})</TabsTrigger>
            <TabsTrigger value="mendan">面談案内 ({mendanCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="宛先・件名で検索..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length > 0 && (
        <p className="text-sm text-muted-foreground">{filtered.length}件</p>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>送信日時</TableHead>
                <TableHead className="w-20">種別</TableHead>
                <TableHead>宛先</TableHead>
                <TableHead>件名</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">
                      {search ? `「${search}」に一致する履歴はありません` : '送信履歴がありません'}
                    </p>
                    {!search && <p className="text-sm text-muted-foreground/70 mt-1">メールが送信されると、ここに記録されます</p>}
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {log.sent_at ? format(new Date(log.sent_at), 'M/d HH:mm', { locale: ja }) : '-'}
                    </TableCell>
                    <TableCell>
                      {log.summary_id ? (
                        <Badge variant="outline" className="text-xs">レポート</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">面談</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{log.to_email}</TableCell>
                    <TableCell className="text-sm max-w-xs">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate">{log.subject}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm">
                          <p>{log.subject}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className={log.status === 'sent' ? 'bg-green-100 text-green-800' : ''}>
                        {log.status === 'sent' ? '送信済み' : '失敗'}
                      </Badge>
                      {log.error_message && (
                        <p className="text-xs text-red-500 mt-1">{log.error_message}</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaginationControl page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}

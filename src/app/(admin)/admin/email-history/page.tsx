'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface EmailLogEntry {
  id: string
  to_email: string
  subject: string
  status: string
  sent_at: string | null
  error_message: string | null
  created_at: string
  student_id: string
}

export default function EmailHistoryPage() {
  const [logs, setLogs] = useState<EmailLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      setLogs(data || [])
      setLoading(false)
    }
    fetchLogs()
  }, [supabase])

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">読み込み中...</p></div>

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">メール送信履歴</h2>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>送信日時</TableHead>
                <TableHead>宛先</TableHead>
                <TableHead>件名</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">履歴がありません</TableCell></TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {log.sent_at ? format(new Date(log.sent_at), 'M/d HH:mm', { locale: ja }) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">{log.to_email}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{log.subject}</TableCell>
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
    </div>
  )
}

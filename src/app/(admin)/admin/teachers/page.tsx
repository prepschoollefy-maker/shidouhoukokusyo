'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CsvImportDialog } from '@/components/csv-import-dialog'

interface Teacher {
  id: string
  display_name: string
  email: string
  assignments: { student: { name: string }; subject: { name: string } | null }[]
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')

  const fetchTeachers = async () => {
    const res = await fetch('/api/teachers')
    const json = await res.json()
    setTeachers(json.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchTeachers() }, [])

  const handleCreate = async () => {
    if (!email || !displayName) { toast.error('必須項目を入力してください'); return }
    try {
      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, display_name: displayName, password: password || undefined }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '登録に失敗しました')
      }
      toast.success('講師を登録しました')
      setDialogOpen(false)
      setEmail(''); setDisplayName(''); setPassword('')
      fetchTeachers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この講師を削除しますか？')) return
    try {
      await fetch(`/api/teachers/${id}`, { method: 'DELETE' })
      toast.success('削除しました')
      fetchTeachers()
    } catch { toast.error('削除に失敗しました') }
  }

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">読み込み中...</p></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">講師管理</h2>
        <div className="flex gap-2">
          <CsvImportDialog
            title="講師CSVインポート"
            description="CSV形式で講師を一括登録します。ヘッダー行が必要です。"
            sampleCsv={"名前,メール,パスワード\n田中先生,tanaka@example.com,password123\n鈴木先生,suzuki@example.com,password456"}
            apiEndpoint="/api/teachers/import"
            onSuccess={fetchTeachers}
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />新規登録</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>講師登録</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>氏名 *</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>メールアドレス *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>初期パスワード（空欄で自動生成）</Label>
                <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="自動生成" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
              <Button onClick={handleCreate}>登録</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>氏名</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>担当生徒</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.display_name}</TableCell>
                  <TableCell>{t.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {[...new Map(t.assignments.map(a => [a.student?.name, a.student?.name])).values()].map((name, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

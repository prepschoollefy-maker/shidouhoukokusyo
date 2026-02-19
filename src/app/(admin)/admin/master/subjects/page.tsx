'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Save } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'

interface Subject { id: string; name: string; sort_order: number }

export default function SubjectsMasterPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const fetchSubjects = async () => {
    const res = await fetch('/api/master/subjects')
    const json = await res.json()
    setSubjects(json.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchSubjects() }, [])

  const handleAdd = async () => {
    if (!newName) return
    try {
      const maxOrder = subjects.reduce((max, s) => Math.max(max, s.sort_order), 0)
      await fetch('/api/master/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, sort_order: maxOrder + 1 }),
      })
      setNewName('')
      toast.success('追加しました')
      fetchSubjects()
    } catch { toast.error('追加に失敗しました') }
  }

  const handleUpdate = async (id: string, name: string, sort_order: number) => {
    try {
      await fetch(`/api/master/subjects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sort_order }),
      })
      toast.success('更新しました')
    } catch { toast.error('更新に失敗しました') }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/master/subjects/${id}`, { method: 'DELETE' })
      toast.success('削除しました')
      fetchSubjects()
    } catch { toast.error('削除に失敗しました') }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">科目マスタ</h2>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新しい科目名" className="flex-1" />
            <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1" />追加</Button>
          </div>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>科目名</TableHead>
                <TableHead className="w-24">順序</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Input defaultValue={s.name} onBlur={(e) => { if (e.target.value !== s.name) handleUpdate(s.id, e.target.value, s.sort_order) }} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" defaultValue={s.sort_order} className="w-20" onBlur={(e) => { const v = parseInt(e.target.value); if (v !== s.sort_order) handleUpdate(s.id, s.name, v) }} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(s.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="科目を削除"
        description="この科目を削除しますか？"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
      />
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CsvImportDialog } from '@/components/csv-import-dialog'
import { toast } from 'sonner'

// ─── Types ───────────────────────────

interface Subject { id: string; name: string; sort_order: number }
interface Attitude { id: string; label: string; category: string; sort_order: number }
interface Textbook { id: string; name: string }

// ─── Main Page ───────────────────────────

export default function MasterPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">マスタ管理</h2>
      <Tabs defaultValue="subjects">
        <TabsList>
          <TabsTrigger value="subjects">科目</TabsTrigger>
          <TabsTrigger value="attitudes">様子</TabsTrigger>
          <TabsTrigger value="textbooks">テキスト</TabsTrigger>
        </TabsList>
        <TabsContent value="subjects"><SubjectsTab /></TabsContent>
        <TabsContent value="attitudes"><AttitudesTab /></TabsContent>
        <TabsContent value="textbooks"><TextbooksTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── 科目タブ ───────────────────────────

function SubjectsTab() {
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
    <div className="space-y-4 mt-4">
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

// ─── 様子タブ ───────────────────────────

function AttitudesTab() {
  const [attitudes, setAttitudes] = useState<Attitude[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [newCategory, setNewCategory] = useState('positive')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const fetchData = async () => {
    const res = await fetch('/api/master/attitudes')
    const json = await res.json()
    setAttitudes(json.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleAdd = async () => {
    if (!newLabel) return
    const sameCategory = attitudes.filter(a => a.category === newCategory)
    const maxOrder = sameCategory.reduce((max, a) => Math.max(max, a.sort_order), 0)
    try {
      await fetch('/api/master/attitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel, category: newCategory, sort_order: maxOrder + 1 }),
      })
      setNewLabel('')
      toast.success('追加しました')
      fetchData()
    } catch { toast.error('追加に失敗しました') }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/master/attitudes/${id}`, { method: 'DELETE' })
      toast.success('削除しました')
      fetchData()
    } catch { toast.error('削除に失敗しました') }
  }

  if (loading) return <LoadingSpinner />

  const positive = attitudes.filter(a => a.category === 'positive')
  const negative = attitudes.filter(a => a.category === 'negative')

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="新しい項目" className="flex-1" />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="positive">ポジティブ</SelectItem>
                <SelectItem value="negative">ネガティブ</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1" />追加</Button>
          </div>

          <div>
            <h3 className="font-medium mb-2 text-green-700">ポジティブ</h3>
            <div className="space-y-1">
              {positive.map(a => (
                <div key={a.id} className="flex items-center justify-between py-1 px-2 bg-green-50 rounded">
                  <span className="text-sm">{a.label}</span>
                  <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(a.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2 text-orange-700">ネガティブ</h3>
            <div className="space-y-1">
              {negative.map(a => (
                <div key={a.id} className="flex items-center justify-between py-1 px-2 bg-orange-50 rounded">
                  <span className="text-sm">{a.label}</span>
                  <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(a.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="項目を削除"
        description="この項目を削除しますか？"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
      />
    </div>
  )
}

// ─── テキストタブ ───────────────────────────

function TextbooksTab() {
  const [textbooks, setTextbooks] = useState<Textbook[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const fetchData = async () => {
    const res = await fetch('/api/master/textbooks')
    const json = await res.json()
    setTextbooks(json.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleAdd = async () => {
    if (!newName) return
    try {
      await fetch('/api/master/textbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      setNewName('')
      toast.success('追加しました')
      fetchData()
    } catch { toast.error('追加に失敗しました') }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/master/textbooks/${id}`, { method: 'DELETE' })
      toast.success('削除しました')
      fetchData()
    } catch { toast.error('削除に失敗しました') }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <CsvImportDialog
          title="テキストCSVインポート"
          description="CSV形式でテキストを一括登録します。ヘッダー行が必要です。"
          sampleCsv={"テキスト名\n新中問 数学1\n新中問 英語1\nシステム英単語"}
          apiEndpoint="/api/master/textbooks/import"
          onSuccess={fetchData}
        />
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="テキスト名" className="flex-1" />
            <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1" />追加</Button>
          </div>
          <div className="space-y-1">
            {textbooks.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                <span className="text-sm">{t.name}</span>
                <Button variant="ghost" size="icon" aria-label="削除" onClick={() => setDeleteTarget(t.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            ))}
            {textbooks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">テキストが登録されていません</p>}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="テキストを削除"
        description="このテキストを削除しますか？"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
      />
    </div>
  )
}

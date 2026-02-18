'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CsvImportDialog } from '@/components/csv-import-dialog'

interface Textbook { id: string; name: string }

export default function TextbooksMasterPage() {
  const [textbooks, setTextbooks] = useState<Textbook[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

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
    if (!confirm('削除しますか？')) return
    try {
      await fetch(`/api/master/textbooks/${id}`, { method: 'DELETE' })
      toast.success('削除しました')
      fetchData()
    } catch { toast.error('削除に失敗しました') }
  }

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">読み込み中...</p></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">テキストマスタ</h2>
        <CsvImportDialog
          title="テキストCSVインポート"
          description="CSV形式でテキストを一括登録します。ヘッダー行が必要です。"
          sampleCsv="テキスト名\n新中問 数学1\n新中問 英語1\nシステム英単語"
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
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            ))}
            {textbooks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">テキストが登録されていません</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

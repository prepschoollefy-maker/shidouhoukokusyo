'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Attitude { id: string; label: string; category: string; sort_order: number }

export default function AttitudesMasterPage() {
  const [attitudes, setAttitudes] = useState<Attitude[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [newCategory, setNewCategory] = useState('positive')
  const [loading, setLoading] = useState(true)

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
    if (!confirm('削除しますか？')) return
    try {
      await fetch(`/api/master/attitudes/${id}`, { method: 'DELETE' })
      toast.success('削除しました')
      fetchData()
    } catch { toast.error('削除に失敗しました') }
  }

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">読み込み中...</p></div>

  const positive = attitudes.filter(a => a.category === 'positive')
  const negative = attitudes.filter(a => a.category === 'negative')

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">生徒の様子マスタ</h2>
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
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

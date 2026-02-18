'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    school_name: '',
    email_signature: '',
    default_summary_frequency: 4,
    auto_send_wait_hours: 24,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(json => { if (json.data) setSettings(json.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      toast.success('設定を保存しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">読み込み中...</p></div>

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">設定</h2>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>塾名</Label>
            <Input value={settings.school_name} onChange={(e) => setSettings({...settings, school_name: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>メール署名</Label>
            <Textarea value={settings.email_signature || ''} onChange={(e) => setSettings({...settings, email_signature: e.target.value})} className="min-h-[100px]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>レポートまとめ生成頻度（何回分のレポートでまとめを生成するか）</Label>
              <Input type="number" value={settings.default_summary_frequency} onChange={(e) => setSettings({...settings, default_summary_frequency: parseInt(e.target.value) || 4})} min="1" />
            </div>
            <div className="space-y-2">
              <Label>自動送信待機時間（時間）</Label>
              <Input type="number" value={settings.auto_send_wait_hours} onChange={(e) => setSettings({...settings, auto_send_wait_hours: parseInt(e.target.value) || 24})} min="1" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '設定を保存'}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

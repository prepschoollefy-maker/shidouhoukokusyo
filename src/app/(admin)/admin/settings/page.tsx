'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { DEFAULT_LESSON_PROMPT, DEFAULT_MONTHLY_PROMPT } from '@/lib/claude/prompts'
import { RotateCcw } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    school_name: '',
    email_signature: '',
    ai_lesson_prompt: '',
    ai_monthly_prompt: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setSettings({
            school_name: json.data.school_name || '',
            email_signature: json.data.email_signature || '',
            ai_lesson_prompt: json.data.ai_lesson_prompt || '',
            ai_monthly_prompt: json.data.ai_monthly_prompt || '',
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_name: settings.school_name,
          email_signature: settings.email_signature,
          ai_lesson_prompt: settings.ai_lesson_prompt || null,
          ai_monthly_prompt: settings.ai_monthly_prompt || null,
        }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      toast.success('設定を保存しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

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
          <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '設定を保存'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AIプロンプト設定</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-6">
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">使用可能なテンプレート変数:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><code className="bg-muted px-1 rounded">{'{student_name}'}</code> - 生徒名</li>
              <li><code className="bg-muted px-1 rounded">{'{grade}'}</code> - 学年（例: &quot;(中2)&quot;）</li>
              <li><code className="bg-muted px-1 rounded">{'{report_data}'}</code> - レポートデータ</li>
              <li><code className="bg-muted px-1 rounded">{'{period_label}'}</code> - 期間ラベル（定期レポートのみ）</li>
            </ul>
            <p className="mt-2">空欄の場合はデフォルトプロンプトが使用されます。</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>授業レポート用プロンプト</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setSettings({ ...settings, ai_lesson_prompt: DEFAULT_LESSON_PROMPT })}
              >
                <RotateCcw className="h-3 w-3" />
                デフォルトに戻す
              </Button>
            </div>
            <Textarea
              value={settings.ai_lesson_prompt}
              onChange={(e) => setSettings({...settings, ai_lesson_prompt: e.target.value})}
              className="min-h-[250px] font-mono text-xs"
              placeholder="空欄 = デフォルトプロンプトを使用"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>定期レポート用プロンプト</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setSettings({ ...settings, ai_monthly_prompt: DEFAULT_MONTHLY_PROMPT })}
              >
                <RotateCcw className="h-3 w-3" />
                デフォルトに戻す
              </Button>
            </div>
            <Textarea
              value={settings.ai_monthly_prompt}
              onChange={(e) => setSettings({...settings, ai_monthly_prompt: e.target.value})}
              className="min-h-[250px] font-mono text-xs"
              placeholder="空欄 = デフォルトプロンプトを使用"
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '設定を保存'}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

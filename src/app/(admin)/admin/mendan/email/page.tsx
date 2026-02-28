'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Send, Mail } from 'lucide-react'
import { toast } from 'sonner'

interface StudentPreview {
  id: string
  name: string
  has_email: boolean
  already_sent: boolean
}

function defaultDeadline() {
  const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  return d.toISOString().split('T')[0]
}

export default function MendanEmailPage() {
  const now = new Date()
  const defaultLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`
  const [periodLabel, setPeriodLabel] = useState(defaultLabel)
  const [deadline, setDeadline] = useState(defaultDeadline)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; skipped: number; errors: string[] } | null>(null)

  // Email config
  const [fromEmail, setFromEmail] = useState('')
  const [bccEmail, setBccEmail] = useState('koji.yamamoto@lefy.jp,takaya.hattori@lefy.jp,hiroyuki.yamamoto@lefy.jp')
  const [defaultBody, setDefaultBody] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [variables, setVariables] = useState<{ key: string; description: string }[]>([])
  const [loadingConfig, setLoadingConfig] = useState(true)

  // Auto-send settings
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [autoDay, setAutoDay] = useState(1)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  // Student selection
  const [students, setStudents] = useState<StudentPreview[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadingStudents, setLoadingStudents] = useState(false)

  useEffect(() => {
    fetch('/api/mendan/email-config')
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setFromEmail(json.data.from_email)
          setDefaultBody(json.data.default_body)
          setCustomBody(json.data.default_body)
          setVariables(json.data.variables || [])
        }
        setLoadingConfig(false)
      })
      .catch(() => setLoadingConfig(false))

    fetch('/api/settings')
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setAutoEnabled(json.data.mendan_auto_send_enabled ?? false)
          setAutoDay(json.data.mendan_auto_send_day ?? 1)
        }
        setLoadingSettings(false)
      })
      .catch(() => setLoadingSettings(false))
  }, [])

  // Fetch students when period label changes
  const fetchStudents = useCallback(async () => {
    if (!periodLabel) return
    setLoadingStudents(true)
    try {
      const res = await fetch(`/api/mendan/send-emails?period_label=${encodeURIComponent(periodLabel)}`)
      const json = await res.json()
      const data: StudentPreview[] = json.data || []
      setStudents(data)
      // Pre-select: has_email and not already_sent
      const eligible = data.filter(s => s.has_email && !s.already_sent).map(s => s.id)
      setSelectedIds(new Set(eligible))
    } catch {
      toast.error('生徒一覧の取得に失敗しました')
    } finally {
      setLoadingStudents(false)
    }
  }, [periodLabel])

  useEffect(() => {
    const timer = setTimeout(fetchStudents, 500)
    return () => clearTimeout(timer)
  }, [fetchStudents])

  const toggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const eligible = students.filter(s => s.has_email && !s.already_sent).map(s => s.id)
    setSelectedIds(new Set(eligible))
  }

  const deselectAll = () => setSelectedIds(new Set())

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mendan_auto_send_enabled: autoEnabled, mendan_auto_send_day: autoDay }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      toast.success('自動送信設定を保存しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSend = async () => {
    if (!periodLabel) {
      toast.error('期間ラベルを入力してください')
      return
    }
    if (selectedIds.size === 0) {
      toast.error('送信先の生徒を選択してください')
      return
    }
    if (sending) return
    setSending(true)
    setResult(null)

    try {
      const isCustom = customBody.trim() !== defaultBody.trim()
      const res = await fetch('/api/mendan/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_label: periodLabel,
          student_ids: Array.from(selectedIds),
          ...(isCustom ? { custom_body: customBody } : {}),
          deadline,
          ...(bccEmail.trim() ? { bcc: bccEmail.split(',').map(e => e.trim()).filter(Boolean) } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '送信に失敗しました')
      setResult(json.data)
      toast.success(`${json.data.sent}件のメールを送信しました`)
      fetchStudents() // Refresh to update already_sent status
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setSending(false)
    }
  }

  const dayOptions = Array.from({ length: 28 }, (_, i) => i + 1)
  const eligibleCount = students.filter(s => s.has_email && !s.already_sent).length

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">面談メール送信</h2>

      {/* 送信元アドレス・BCC */}
      {!loadingConfig && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">送信元:</span>
              <span className="text-sm font-medium">{fromEmail}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm text-muted-foreground ml-5 mt-1">BCC:</span>
              <div className="flex-1 max-w-md space-y-1">
                <Input
                  value={bccEmail}
                  onChange={(e) => setBccEmail(e.target.value)}
                  placeholder="例: info@example.com（カンマ区切りで複数可）"
                  className="font-mono text-xs"
                />
                <span className="text-xs text-muted-foreground">カンマ区切りで複数指定可。不要な場合は空にしてください</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 自動送信設定 */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">自動送信</p>
              <p className="text-xs text-muted-foreground">毎月指定した日時に面談案内メールを自動送信します</p>
            </div>
            {!loadingSettings && <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />}
          </div>
          {autoEnabled && (
            <div className="flex items-end gap-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">毎月</Label>
                <Select value={String(autoDay)} onValueChange={(v) => setAutoDay(Number(v))}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dayOptions.map(d => <SelectItem key={d} value={String(d)}>{d}日</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings}>{savingSettings ? '保存中...' : '保存'}</Button>
            </div>
          )}
          {!autoEnabled && !loadingSettings && (
            <Button size="sm" variant="outline" onClick={handleSaveSettings} disabled={savingSettings}>{savingSettings ? '保存中...' : 'OFFで保存'}</Button>
          )}
        </CardContent>
      </Card>

      {/* 手動送信 */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm font-medium">手動送信</p>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>期間ラベル</Label>
              <Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="例：2026年3月" className="w-48" />
            </div>
            <div className="space-y-2">
              <Label>回答期限</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-48" />
            </div>
          </div>

          {/* 送信先選択 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>送信先 ({selectedIds.size}/{eligibleCount}名 選択中)</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={selectAll}>全選択</Button>
                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={deselectAll}>全解除</Button>
              </div>
            </div>
            <div className="border rounded-md max-h-[200px] overflow-y-auto">
              {loadingStudents ? (
                <div className="p-4 text-center text-sm text-muted-foreground">読み込み中...</div>
              ) : students.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">対象の生徒がいません</div>
              ) : (
                <div className="divide-y">
                  {students.map(s => {
                    const disabled = !s.has_email
                    const reason = !s.has_email ? 'メール未登録' : s.already_sent ? '送信済み（再送可）' : null
                    return (
                      <label key={s.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${disabled ? 'opacity-50' : 'hover:bg-muted/50 cursor-pointer'}`}>
                        <Checkbox
                          checked={selectedIds.has(s.id)}
                          onCheckedChange={() => toggleStudent(s.id)}
                          disabled={disabled}
                        />
                        <span className="flex-1">{s.name}</span>
                        {reason && <span className="text-xs text-muted-foreground">{reason}</span>}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* メール本文 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>メール本文</Label>
              {customBody.trim() !== defaultBody.trim() && (
                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setCustomBody(defaultBody)}>デフォルトに戻す</Button>
              )}
            </div>
            <Textarea value={customBody} onChange={(e) => setCustomBody(e.target.value)} rows={6} placeholder="メール本文を入力..." className="font-mono text-sm" />
            {variables.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="font-medium">利用可能な変数:</p>
                {variables.map(v => (
                  <p key={v.key}><code className="bg-muted px-1 rounded">{v.key}</code> … {v.description}</p>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleSend} disabled={sending || selectedIds.size === 0}>
            <Send className="h-4 w-4 mr-1" />
            {sending ? '送信中...' : `${selectedIds.size}名に送信`}
          </Button>

          {result && (
            <div className="bg-gray-50 rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium">送信結果</p>
              <div className="text-sm space-y-1">
                <p>送信成功: {result.sent}件</p>
                <p>スキップ（送信済み）: {result.skipped}件</p>
                {result.errors.length > 0 && (
                  <div>
                    <p className="text-red-600">エラー: {result.errors.length}件</p>
                    <ul className="list-disc list-inside text-red-600 text-xs mt-1">
                      {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

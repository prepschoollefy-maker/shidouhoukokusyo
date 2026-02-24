'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecovery, setIsRecovery] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // PASSWORD_RECOVERY イベントを検知して新パスワード入力画面を表示
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      }
    })

    // すでにリカバリーセッションで到達している場合（ページリロード対策）
    // URLにtype=recoveryがある場合のみリカバリーとして扱う
    const params = new URLSearchParams(window.location.search)
    if (params.get('type') === 'recovery') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setIsRecovery(true)
        }
      })
    }

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  // メール送信（リセットリンク送信）
  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    if (resetError) {
      console.error('Supabase resetPassword error:', resetError.message, resetError)
      setError(`パスワードリセットメールの送信に失敗しました: ${resetError.message}`)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  // 新パスワード設定
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      setError('パスワードの更新に失敗しました。もう一度お試しください。')
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    setDone(true)
    setLoading(false)
  }

  // 完了画面
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>パスワード変更完了</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              パスワードが変更されました。新しいパスワードでログインしてください。
            </p>
            <a href="/login">
              <Button className="w-full">ログインページへ</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 新パスワード入力画面（リカバリーリンクからのリダイレクト時）
  if (isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>新しいパスワードを設定</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">新しいパスワード</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6文字以上"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPasswordConfirm">新しいパスワード（確認）</Label>
                <Input
                  id="newPasswordConfirm"
                  type={showPassword ? 'text' : 'password'}
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '変更中...' : 'パスワードを変更'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // メール送信完了画面
  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>メール送信完了</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              パスワードリセット用のリンクを送信しました。メールをご確認ください。
            </p>
            <a href="/login" className="text-sm text-blue-600 hover:underline">
              ログイン画面に戻る
            </a>
          </CardContent>
        </Card>
      </div>
    )
  }

  // メール入力画面
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>パスワードリセット</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '送信中...' : 'リセットメールを送信'}
            </Button>
            <div className="text-center">
              <a href="/login" className="text-sm text-blue-600 hover:underline">
                ログイン画面に戻る
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

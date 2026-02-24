'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      console.error('Supabase signIn error:', authError.message, authError)
      if (authError.message.includes('Email not confirmed')) {
        setError('メールアドレスの確認が完了していません。管理者にお問い合わせください。')
      } else if (authError.message.includes('Invalid login credentials')) {
        setError('メールアドレスまたはパスワードが正しくありません')
      } else {
        setError(`ログインに失敗しました: ${authError.message}`)
      }
      setLoading(false)
      return
    }

    const role = data.user?.app_metadata?.role || 'teacher'
    if (role === 'admin') {
      await supabase.auth.signOut()
      setError('管理者アカウントはこちらからログインできません')
      setLoading(false)
      return
    }
    router.push('/reports')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">レフィー</CardTitle>
          <p className="text-sm text-muted-foreground">講師ログイン</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
            <div className="text-center space-y-1">
              <a href="/register" className="text-sm text-blue-600 hover:underline block">
                講師アカウント登録
              </a>
              <a href="/reset-password" className="text-sm text-blue-600 hover:underline block">
                パスワードを忘れた方
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

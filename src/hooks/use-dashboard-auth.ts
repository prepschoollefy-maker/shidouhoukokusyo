'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

const STORAGE_KEY = 'dashboard_pw'

/**
 * 契約系ページ共通のパスワード認証フック。
 * sessionStorageにパスワードを保存し、通常コース/講習/請求・入金/経営ダッシュボード間で共有する。
 */
export function useDashboardAuth() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [storedPw, setStoredPw] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [initializing, setInitializing] = useState(true)

  // マウント時にsessionStorageを確認
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) {
      setStoredPw(saved)
      setAuthenticated(true)
    }
    setInitializing(false)
  }, [])

  /**
   * パスワード認証を実行。
   * verifyUrl: 検証に使うAPIエンドポイント（GETでpwクエリパラメータ付き）
   */
  const handleAuth = useCallback(async (verifyUrl: string) => {
    if (!password) {
      toast.error('パスワードを入力してください')
      return false
    }
    setVerifying(true)
    try {
      const sep = verifyUrl.includes('?') ? '&' : '?'
      const res = await fetch(`${verifyUrl}${sep}pw=${encodeURIComponent(password)}`)
      if (res.status === 403) {
        toast.error('パスワードが正しくありません')
        return false
      }
      if (!res.ok) throw new Error('エラーが発生しました')
      sessionStorage.setItem(STORAGE_KEY, password)
      setStoredPw(password)
      setAuthenticated(true)
      return true
    } catch {
      toast.error('認証に失敗しました')
      return false
    } finally {
      setVerifying(false)
    }
  }, [password])

  /**
   * 認証失敗時（403等）にsessionStorageをクリアして再認証を要求。
   */
  const clearAuth = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setStoredPw('')
    setAuthenticated(false)
  }, [])

  return {
    authenticated,
    password,
    setPassword,
    storedPw,
    verifying,
    initializing,
    handleAuth,
    clearAuth,
  }
}

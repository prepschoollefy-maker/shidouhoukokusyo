'use client'

import { createContext, useContext } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useDashboardAuth } from '@/hooks/use-dashboard-auth'

interface ContractAuthContextValue {
  storedPw: string
  clearAuth: () => void
}

const ContractAuthContext = createContext<ContractAuthContextValue | null>(null)

export function useContractAuth(): ContractAuthContextValue {
  const ctx = useContext(ContractAuthContext)
  if (!ctx) throw new Error('useContractAuth must be used within contracts layout')
  return ctx
}

export default function ContractsLayout({ children }: { children: React.ReactNode }) {
  const { authenticated, password, setPassword, storedPw, verifying, initializing, handleAuth: authHandler, clearAuth } = useDashboardAuth()

  const handleAuth = () => authHandler('/api/contracts')

  if (initializing) return <LoadingSpinner />

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-bold">契約セクション</h2>
              <p className="text-sm text-muted-foreground text-center">閲覧にはパスワードが必要です</p>
            </div>
            <div className="space-y-2">
              <Label>パスワード</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAuth() }}
                autoFocus
              />
            </div>
            <Button className="w-full" onClick={handleAuth} disabled={verifying}>
              {verifying ? '確認中...' : 'ログイン'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <ContractAuthContext.Provider value={{ storedPw, clearAuth }}>
      {children}
    </ContractAuthContext.Provider>
  )
}

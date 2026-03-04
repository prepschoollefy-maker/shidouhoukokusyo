'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, LogOut } from 'lucide-react'

export function TeacherHeader() {
  const [displayName, setDisplayName] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setDisplayName(user.user_metadata?.display_name || '')
      }
    }
    getUser()
  }, [supabase.auth])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-white border-b sticky top-0 z-40">
      <div className="px-4 h-14 flex items-center justify-between">
        <h1 className="text-lg font-bold">レフィー</h1>
        <div className="flex items-center gap-3">
          {displayName && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{displayName}</span>
            </div>
          )}
          <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground" title="ログアウト">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

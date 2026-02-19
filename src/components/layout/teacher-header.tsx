'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from 'lucide-react'

export function TeacherHeader() {
  const [displayName, setDisplayName] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setDisplayName(user.user_metadata?.display_name || '')
      }
    }
    getUser()
  }, [supabase.auth])

  return (
    <header className="bg-white border-b sticky top-0 z-40">
      <div className="px-4 h-14 flex items-center justify-between">
        <h1 className="text-lg font-bold">レフィー</h1>
        {displayName && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{displayName}</span>
          </div>
        )}
      </div>
    </header>
  )
}

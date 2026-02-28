'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ClipboardList, PlusCircle, Camera, Users, HelpCircle, LogOut, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/reports', label: 'レポート', icon: ClipboardList },
  { href: '/reports/new', label: '新規入力', icon: PlusCircle },
  { href: '/ocr', label: '写真入力', icon: Camera },
  { href: '/schedule', label: '時間割', icon: CalendarDays },
  { href: '/students', label: '生徒カルテ', icon: Users },
]

export function TeacherNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full text-xs',
                isActive ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              <Icon className="h-5 w-5 mb-1" />
              {item.label}
            </Link>
          )
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center w-full h-full text-xs text-gray-500"
        >
          <LogOut className="h-5 w-5 mb-1" />
          ログアウト
        </button>
      </div>
    </nav>
  )
}

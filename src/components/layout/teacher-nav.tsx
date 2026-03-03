'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, PlusCircle, Camera, Users, HelpCircle, CalendarDays, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/schedule', label: 'スケジュール', icon: Calendar },
  { href: '/reports', label: 'レポート', icon: ClipboardList },
  { href: '/reports/new', label: '新規入力', icon: PlusCircle },
  { href: '/ocr', label: '写真入力', icon: Camera },
  { href: '/closed-days', label: '休館日', icon: CalendarDays },
  { href: '/students', label: '生徒カルテ', icon: Users },
  { href: '/guide', label: '使い方', icon: HelpCircle },
]

export function TeacherNav() {
  const pathname = usePathname()

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
      </div>
    </nav>
  )
}

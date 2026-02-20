'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  FileText,
  Users,
  GraduationCap,
  Mail,
  Settings,
  BookOpen,
  LogOut,
  ClipboardList,
  Printer,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/admin/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/admin/summaries', label: '定期レポート', icon: FileText },
  { href: '/admin/reports', label: 'レポート一覧', icon: ClipboardList },
  { href: '/print', label: 'レポート用紙', icon: Printer, external: true },
  { href: '/admin/students', label: '生徒管理', icon: GraduationCap },
  { href: '/admin/teachers', label: '講師管理', icon: Users },
  { href: '/admin/mendan', label: '面談管理', icon: Calendar },
  { href: '/admin/email-history', label: 'メール履歴', icon: Mail },
  { href: '/admin/master/subjects', label: '科目マスタ', icon: BookOpen },
  { href: '/admin/master/attitudes', label: '様子マスタ', icon: BookOpen },
  { href: '/admin/master/textbooks', label: 'テキストマスタ', icon: BookOpen },
  { href: '/admin/settings', label: '設定', icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-gray-900">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 px-4 bg-gray-900">
          <h1 className="text-xl font-bold text-white">レフィー管理</h1>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                )}
              >
                <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-2 py-4 border-t border-gray-700">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-700"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            ログアウト
          </Button>
        </div>
      </div>
    </aside>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Menu, X, LayoutDashboard, FileText, Users, GraduationCap, Mail, Settings, BookOpen, LogOut, ClipboardList, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const navItems = [
  { href: '/admin/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/admin/summaries', label: '定期レポート', icon: FileText },
  { href: '/admin/reports', label: 'レポート一覧', icon: ClipboardList },
  { href: '/print', label: 'レポート用紙', icon: Printer, external: true },
  { href: '/admin/students', label: '生徒管理', icon: GraduationCap },
  { href: '/admin/teachers', label: '講師管理', icon: Users },
  { href: '/admin/email-history', label: 'メール履歴', icon: Mail },
  { href: '/admin/master/subjects', label: '科目マスタ', icon: BookOpen },
  { href: '/admin/master/attitudes', label: '様子マスタ', icon: BookOpen },
  { href: '/admin/master/textbooks', label: 'テキストマスタ', icon: BookOpen },
  { href: '/admin/settings', label: '設定', icon: Settings },
]

export function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="md:hidden flex items-center justify-between h-14 px-4 border-b bg-white sticky top-0 z-50">
      <h1 className="text-lg font-bold">レフィー管理</h1>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex items-center h-14 px-4 border-b">
            <h2 className="text-lg font-bold">メニュー</h2>
          </div>
          <nav className="px-2 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md',
                    isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="px-2 py-4 border-t">
            <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
              <LogOut className="mr-3 h-5 w-5" />
              ログアウト
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

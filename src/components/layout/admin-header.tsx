'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Menu,
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
  ClipboardCheck,
  Send,
  Clock,
  FileSignature,
  Receipt,
  TrendingUp,
  ExternalLink,
  BookOpenCheck,
  History,
  ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  external?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: (NavItem | NavGroup)[] = [
  { href: '/admin/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  {
    label: 'レポート',
    items: [
      { href: '/admin/summaries', label: '定期レポート', icon: FileText },
      { href: '/admin/reports', label: 'レポート一覧', icon: ClipboardList },
      { href: '/print', label: 'レポート用紙', icon: Printer, external: true },
    ],
  },
  {
    label: '面談',
    items: [
      { href: '/admin/mendan', label: '面談一覧', icon: Calendar },
      { href: '/admin/mendan/requests', label: '希望申請', icon: ClipboardCheck },
      { href: '/admin/mendan/email', label: 'メール送信', icon: Send },
    ],
  },
  {
    label: '授業管理',
    items: [
      { href: '/admin/lessons/master', label: '授業マスタ', icon: Clock },
    ],
  },
  {
    label: '契約',
    items: [
      { href: '/admin/contracts', label: '通常コース管理', icon: FileSignature },
      { href: '/admin/contracts/lectures', label: '講習管理', icon: BookOpenCheck },
      { href: '/admin/contracts/materials', label: '教材販売', icon: ShoppingBag },
      { href: '/admin/contracts/billing', label: '請求・入金', icon: Receipt },
      { href: '/admin/contracts/billing/history', label: '入金履歴', icon: History },
      { href: '/admin/contracts/dashboard', label: '経営ダッシュボード', icon: TrendingUp },
      { href: 'https://contract.lefy.jp', label: '契約書作成', icon: ExternalLink, external: true },
    ],
  },
  {
    label: '管理',
    items: [
      { href: '/admin/students', label: '生徒管理', icon: GraduationCap },
      { href: '/admin/teachers', label: '講師管理', icon: Users },
    ],
  },
  {
    label: 'その他',
    items: [
      { href: '/admin/email-history', label: 'メール履歴', icon: Mail },
      { href: '/admin/master', label: 'マスタ管理', icon: BookOpen },
      { href: '/admin/settings', label: '設定', icon: Settings },
    ],
  },
]

function isNavItem(item: NavItem | NavGroup): item is NavItem {
  return 'href' in item
}

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

  const renderLink = (item: NavItem) => {
    const Icon = item.icon
    const isActive = ['/admin/mendan', '/admin/contracts/billing'].includes(item.href)
      ? pathname === item.href
      : pathname.startsWith(item.href)
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
          <nav className="px-2 py-4 space-y-1 overflow-y-auto">
            {navGroups.map((entry, i) => {
              if (isNavItem(entry)) {
                return renderLink(entry)
              }
              return (
                <div key={entry.label} className={cn(i > 0 && 'pt-3')}>
                  <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {entry.label}
                  </p>
                  {entry.items.map(renderLink)}
                </div>
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

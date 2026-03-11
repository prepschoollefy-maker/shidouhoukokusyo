'use client'

import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { AdminHeader } from '@/components/layout/admin-header'
import { SidebarProvider, useSidebar } from '@/components/layout/sidebar-context'
import { cn } from '@/lib/utils'

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-clip">
      <AdminSidebar />
      <AdminHeader />
      <main className={cn('min-w-0 transition-all duration-200', collapsed ? 'md:ml-16' : 'md:ml-64')}>
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </SidebarProvider>
  )
}

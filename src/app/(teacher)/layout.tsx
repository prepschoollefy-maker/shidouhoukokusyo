import { TeacherNav } from '@/components/layout/teacher-nav'
import { TeacherHeader } from '@/components/layout/teacher-header'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <TeacherHeader />
      <main className="p-4">
        {children}
      </main>
      <TeacherNav />
    </div>
  )
}

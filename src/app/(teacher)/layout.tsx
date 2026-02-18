import { TeacherNav } from '@/components/layout/teacher-nav'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="px-4 h-14 flex items-center">
          <h1 className="text-lg font-bold">レフィー</h1>
        </div>
      </header>
      <main className="p-4">
        {children}
      </main>
      <TeacherNav />
    </div>
  )
}

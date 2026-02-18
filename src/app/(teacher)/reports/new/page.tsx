'use client'

import { ReportForm } from '@/components/reports/report-form'

export default function NewReportPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">レポート入力</h2>
      <ReportForm />
    </div>
  )
}

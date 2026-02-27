'use client'

import { ReportForm } from '@/components/reports/report-form'

export default function NewReportPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">レポート入力</h2>
        <p className="text-sm text-muted-foreground mt-1">授業内容と生徒の様子を記録してください</p>
      </div>
      <ReportForm />
    </div>
  )
}

'use client'

import { ReportForm } from '@/components/reports/report-form'
import { ClosedDaysCalendarDialog } from '@/components/closed-days-calendar-dialog'

export default function NewReportPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">レポート入力</h2>
          <p className="text-sm text-muted-foreground mt-1">授業内容と生徒の様子を記録してください</p>
        </div>
        <ClosedDaysCalendarDialog />
      </div>
      <ReportForm />
    </div>
  )
}

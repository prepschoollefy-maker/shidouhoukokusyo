import type { Summary, Student, Subject, SummaryReport } from './database'
import type { ReportWithDetails } from './report'

export interface SummaryWithDetails extends Summary {
  student: Pick<Student, 'id' | 'name' | 'grade'>
  subject: Pick<Subject, 'id' | 'name'> | null
  summary_reports: (SummaryReport & {
    report: ReportWithDetails
  })[]
}

export interface SummaryListItem extends Summary {
  student: Pick<Student, 'id' | 'name'>
  subject: Pick<Subject, 'id' | 'name'> | null
  report_count: number
}

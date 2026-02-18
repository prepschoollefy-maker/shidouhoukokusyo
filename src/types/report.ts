import type { LessonReport, ReportTextbook, ReportAttitude, AttitudeOption, Student, Subject, Profile } from './database'

export interface ReportWithDetails extends LessonReport {
  student: Pick<Student, 'id' | 'name' | 'grade'>
  subject: Pick<Subject, 'id' | 'name'>
  teacher: Pick<Profile, 'id' | 'display_name'>
  report_textbooks: ReportTextbook[]
  report_attitudes: (ReportAttitude & {
    attitude_option: AttitudeOption
  })[]
}

export interface ReportFormData {
  student_id: string
  lesson_date: string
  subject_id: string
  textbooks: {
    textbook_name: string
    pages: string
  }[]
  unit_covered: string
  homework_check: 'done' | 'partial' | 'not_done'
  positive_attitudes: string[]
  negative_attitudes: string[]
  free_comment: string
  homework_assigned: string
  next_lesson_plan: string
  internal_notes: string
}

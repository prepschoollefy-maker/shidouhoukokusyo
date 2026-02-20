export type UserRole = 'admin' | 'teacher'

export type HomeworkCheck = 'done' | 'partial' | 'not_done'

export type SummaryStatus = 'unchecked' | 'approved' | 'sent' | 'on_hold'

export type SendMode = 'manual' | 'auto_send'

export type SummaryFrequency = number // default 4

export type StudentStatus = 'active' | 'withdrawn'

export type AttitudeCategory = 'positive' | 'negative'

export interface Profile {
  id: string
  role: UserRole
  display_name: string
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  name: string
  grade: string | null
  send_mode: SendMode
  weekly_lesson_count: number | null
  status: StudentStatus
  created_at: string
  updated_at: string
}

export interface ParentEmail {
  id: string
  student_id: string
  email: string
  label: string | null
  created_at: string
}

export interface Subject {
  id: string
  name: string
  sort_order: number
  created_at: string
}

export interface StudentSubject {
  id: string
  student_id: string
  subject_id: string
}

export interface TeacherStudentAssignment {
  id: string
  teacher_id: string
  student_id: string
  subject_id: string | null
  created_at: string
}

export interface AttitudeOption {
  id: string
  label: string
  category: AttitudeCategory
  sort_order: number
  created_at: string
}

export interface TextbookSuggestion {
  id: string
  name: string
  created_at: string
}

export interface LessonReport {
  id: string
  teacher_id: string
  student_id: string
  subject_id: string
  lesson_date: string
  unit_covered: string
  homework_check: HomeworkCheck
  free_comment: string | null
  homework_assigned: string
  next_lesson_plan: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
}

export interface ReportTextbook {
  id: string
  report_id: string
  textbook_name: string
  pages: string | null
  sort_order: number
}

export interface ReportAttitude {
  id: string
  report_id: string
  attitude_option_id: string
}

export interface Summary {
  id: string
  student_id: string
  subject_id: string | null
  status: SummaryStatus
  content: string
  period_start: string
  period_end: string
  auto_send_at: string | null
  created_at: string
  updated_at: string
}

export interface SummaryReport {
  id: string
  summary_id: string
  report_id: string
}

export interface EmailLog {
  id: string
  summary_id: string | null
  student_id: string
  to_email: string
  subject: string
  body: string
  status: string
  sent_at: string | null
  error_message: string | null
  created_at: string
}

export interface SchoolSettings {
  id: string
  school_name: string
  email_signature: string | null
  auto_send_wait_hours: number
  created_at: string
  updated_at: string
}

export interface MendanToken {
  id: string
  student_id: string
  token: string
  period_label: string
  expires_at: string
  created_at: string
}

export interface MendanRequest {
  id: string
  token_id: string
  student_id: string
  candidate1: string
  candidate2: string
  candidate3: string
  message: string | null
  submitted_at: string
}

export interface MendanRecord {
  id: string
  student_id: string
  mendan_date: string
  attendees: string | null
  content: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

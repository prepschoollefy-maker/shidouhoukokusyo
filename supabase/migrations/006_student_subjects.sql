CREATE TABLE public.student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  UNIQUE(student_id, subject_id)
);

ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.student_subjects
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "teacher_read_assigned" ON public.student_subjects
  FOR SELECT USING (
    student_id IN (SELECT public.get_teacher_student_ids())
  );

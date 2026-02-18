CREATE TABLE public.teacher_student_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, student_id, subject_id)
);

ALTER TABLE public.teacher_student_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.teacher_student_assignments
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "teacher_read_own" ON public.teacher_student_assignments
  FOR SELECT USING (teacher_id = auth.uid());

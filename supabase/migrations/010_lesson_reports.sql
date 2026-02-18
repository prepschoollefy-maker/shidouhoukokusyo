CREATE TABLE public.lesson_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id),
  student_id uuid NOT NULL REFERENCES public.students(id),
  subject_id uuid NOT NULL REFERENCES public.subjects(id),
  lesson_date date NOT NULL,
  unit_covered text NOT NULL,
  homework_check text NOT NULL CHECK (homework_check IN ('done', 'partial', 'not_done')),
  free_comment text,
  homework_assigned text NOT NULL,
  next_lesson_plan text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER lesson_reports_updated_at
  BEFORE UPDATE ON public.lesson_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.lesson_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.lesson_reports
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "teacher_read_own_students" ON public.lesson_reports
  FOR SELECT USING (
    public.get_user_role() = 'teacher'
    AND student_id IN (SELECT public.get_teacher_student_ids())
  );

CREATE POLICY "teacher_insert_own" ON public.lesson_reports
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND student_id IN (SELECT public.get_teacher_student_ids())
  );

CREATE POLICY "teacher_update_own_recent" ON public.lesson_reports
  FOR UPDATE USING (
    teacher_id = auth.uid()
    AND created_at > now() - interval '24 hours'
  ) WITH CHECK (
    teacher_id = auth.uid()
  );

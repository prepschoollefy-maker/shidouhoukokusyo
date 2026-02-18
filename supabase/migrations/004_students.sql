CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  grade text,
  summary_frequency integer NOT NULL DEFAULT 4,
  send_mode text NOT NULL DEFAULT 'manual' CHECK (send_mode IN ('manual', 'auto_send')),
  weekly_lesson_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.students
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "teacher_read_assigned" ON public.students
  FOR SELECT USING (
    public.get_user_role() = 'teacher'
    AND id IN (SELECT public.get_teacher_student_ids())
  );

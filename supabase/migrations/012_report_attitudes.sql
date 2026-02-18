CREATE TABLE public.report_attitudes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.lesson_reports(id) ON DELETE CASCADE,
  attitude_option_id uuid NOT NULL REFERENCES public.attitude_options(id) ON DELETE CASCADE,
  UNIQUE(report_id, attitude_option_id)
);

ALTER TABLE public.report_attitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.report_attitudes
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "teacher_read" ON public.report_attitudes
  FOR SELECT USING (
    report_id IN (
      SELECT id FROM public.lesson_reports
      WHERE student_id IN (SELECT public.get_teacher_student_ids())
    )
  );

CREATE POLICY "teacher_insert" ON public.report_attitudes
  FOR INSERT WITH CHECK (
    report_id IN (
      SELECT id FROM public.lesson_reports WHERE teacher_id = auth.uid()
    )
  );

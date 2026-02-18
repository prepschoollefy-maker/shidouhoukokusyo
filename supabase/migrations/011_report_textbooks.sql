CREATE TABLE public.report_textbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.lesson_reports(id) ON DELETE CASCADE,
  textbook_name text NOT NULL,
  pages text,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.report_textbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.report_textbooks
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "teacher_read" ON public.report_textbooks
  FOR SELECT USING (
    report_id IN (
      SELECT id FROM public.lesson_reports
      WHERE student_id IN (SELECT public.get_teacher_student_ids())
    )
  );

CREATE POLICY "teacher_insert" ON public.report_textbooks
  FOR INSERT WITH CHECK (
    report_id IN (
      SELECT id FROM public.lesson_reports WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "teacher_update" ON public.report_textbooks
  FOR UPDATE USING (
    report_id IN (
      SELECT id FROM public.lesson_reports
      WHERE teacher_id = auth.uid() AND created_at > now() - interval '24 hours'
    )
  );

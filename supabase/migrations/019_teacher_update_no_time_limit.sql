-- Remove 24-hour time limit for teacher report updates
DROP POLICY IF EXISTS "teacher_update_own_recent" ON public.lesson_reports;
CREATE POLICY "teacher_update_own" ON public.lesson_reports
  FOR UPDATE USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

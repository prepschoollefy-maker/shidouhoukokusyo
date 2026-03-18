-- Allow teachers to delete their own reports
CREATE POLICY "teacher_delete_own" ON public.lesson_reports
  FOR DELETE USING (
    public.get_user_role() = 'teacher'
    AND teacher_id = auth.uid()
  );

-- ============================================================
-- 038: 授業管理テーブルのRLSポリシー修正
-- auth.users テーブル直接参照 → auth.jwt() に変更
-- ============================================================

-- time_slots
DROP POLICY IF EXISTS "admin modify time_slots" ON public.time_slots;
CREATE POLICY "admin modify time_slots" ON public.time_slots
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- slot_availability
DROP POLICY IF EXISTS "admin modify slot_availability" ON public.slot_availability;
CREATE POLICY "admin modify slot_availability" ON public.slot_availability
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- booths
DROP POLICY IF EXISTS "admin modify booths" ON public.booths;
CREATE POLICY "admin modify booths" ON public.booths
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- instructor_shifts
DROP POLICY IF EXISTS "admin full access instructor_shifts" ON public.instructor_shifts;
CREATE POLICY "admin full access instructor_shifts" ON public.instructor_shifts
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- regular_lesson_templates
DROP POLICY IF EXISTS "admin full access regular_lesson_templates" ON public.regular_lesson_templates;
CREATE POLICY "admin full access regular_lesson_templates" ON public.regular_lesson_templates
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- lessons
DROP POLICY IF EXISTS "admin full access lessons" ON public.lessons;
CREATE POLICY "admin full access lessons" ON public.lessons
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- reschedule_requests
DROP POLICY IF EXISTS "admin full access reschedule_requests" ON public.reschedule_requests;
CREATE POLICY "admin full access reschedule_requests" ON public.reschedule_requests
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

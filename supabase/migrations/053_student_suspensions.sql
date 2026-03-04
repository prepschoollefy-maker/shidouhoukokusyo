-- ============================================================
-- 053: 休塾管理テーブル + 授業生成関数の更新
-- ============================================================

-- 休塾テーブル
CREATE TABLE public.student_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  start_ym text NOT NULL,   -- 'YYYY-MM'
  end_ym text NOT NULL,     -- 'YYYY-MM'
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suspensions_ym_order CHECK (start_ym <= end_ym)
);

ALTER TABLE public.student_suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_suspensions" ON public.student_suspensions
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- generate_lessons_for_range: 休塾期間スキップ追加
CREATE OR REPLACE FUNCTION public.generate_lessons_for_range(
  p_start_date date,
  p_end_date date
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.lessons (
    student_id, teacher_id, subject_id,
    lesson_date, time_slot_id, booth_id,
    lesson_type, template_id, notes, status
  )
  SELECT
    t.student_id,
    t.teacher_id,
    t.subject_id,
    d.dt::date,
    t.time_slot_id,
    t.booth_id,
    'regular',
    t.id,
    COALESCE(t.notes, ''),
    'scheduled'
  FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS d(dt)
  JOIN public.regular_lesson_templates t
    ON t.is_active = true
   AND t.day_of_week = EXTRACT(DOW FROM d.dt)::integer
  WHERE NOT EXISTS (
    SELECT 1 FROM public.closed_days cd
    WHERE cd.closed_date = d.dt::date
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.student_suspensions ss
    WHERE ss.student_id = t.student_id
    AND to_char(d.dt, 'YYYY-MM') >= ss.start_ym
    AND to_char(d.dt, 'YYYY-MM') <= ss.end_ym
  )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- generate_lessons_for_template: 休塾期間スキップ追加
CREATE OR REPLACE FUNCTION public.generate_lessons_for_template(
  p_template_id uuid,
  p_start_date date,
  p_end_date date
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.lessons (
    student_id, teacher_id, subject_id,
    lesson_date, time_slot_id, booth_id,
    lesson_type, template_id, notes, status
  )
  SELECT t.student_id, t.teacher_id, t.subject_id,
    d.dt::date, t.time_slot_id, t.booth_id,
    'regular', t.id, COALESCE(t.notes, ''), 'scheduled'
  FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS d(dt)
  JOIN public.regular_lesson_templates t
    ON t.id = p_template_id AND t.is_active = true
    AND t.day_of_week = EXTRACT(DOW FROM d.dt)::integer
  WHERE NOT EXISTS (
    SELECT 1 FROM public.closed_days cd WHERE cd.closed_date = d.dt::date
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.student_suspensions ss
    WHERE ss.student_id = t.student_id
    AND to_char(d.dt, 'YYYY-MM') >= ss.start_ym
    AND to_char(d.dt, 'YYYY-MM') <= ss.end_ym
  )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- ============================================================
-- 040: 授業自動生成 SQL 関数
-- ============================================================

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
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

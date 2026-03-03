-- 振替授業の元授業を参照するカラムを追加
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS original_lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_original_lesson ON public.lessons(original_lesson_id)
  WHERE original_lesson_id IS NOT NULL;

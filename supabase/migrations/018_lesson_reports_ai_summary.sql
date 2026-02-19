-- Add per-lesson AI summary column
ALTER TABLE public.lesson_reports ADD COLUMN ai_summary text;

-- Add strengths/weaknesses columns to lesson_reports
ALTER TABLE public.lesson_reports ADD COLUMN strengths text;
ALTER TABLE public.lesson_reports ADD COLUMN weaknesses text;

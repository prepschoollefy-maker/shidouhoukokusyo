-- lesson_reports.teacher_id を nullable にし、講師削除時に SET NULL にする
ALTER TABLE public.lesson_reports
  ALTER COLUMN teacher_id DROP NOT NULL;

ALTER TABLE public.lesson_reports
  DROP CONSTRAINT lesson_reports_teacher_id_fkey,
  ADD CONSTRAINT lesson_reports_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- mendan_records.created_by も ON DELETE SET NULL を追加
ALTER TABLE public.mendan_records
  DROP CONSTRAINT mendan_records_created_by_fkey,
  ADD CONSTRAINT mendan_records_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

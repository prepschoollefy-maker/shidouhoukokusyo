-- status に 'deleted' を追加（論理削除用）
ALTER TABLE public.students DROP CONSTRAINT students_status_check;
ALTER TABLE public.students ADD CONSTRAINT students_status_check
  CHECK (status IN ('active', 'withdrawn', 'deleted'));

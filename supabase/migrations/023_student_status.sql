-- 生徒ステータス（通塾生/退塾済）カラム追加
ALTER TABLE public.students
  ADD COLUMN status text NOT NULL DEFAULT 'active'
  CONSTRAINT students_status_check CHECK (status IN ('active', 'withdrawn'));

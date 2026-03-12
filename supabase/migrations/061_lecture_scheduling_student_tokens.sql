-- 生徒個別のURL発行用トークン
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.lecture_scheduling_student_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.lecture_scheduling_periods(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, student_id)
);

CREATE INDEX idx_lsst_token ON public.lecture_scheduling_student_tokens (token);

ALTER TABLE public.lecture_scheduling_student_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on lecture_scheduling_student_tokens"
  ON public.lecture_scheduling_student_tokens FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- 生徒トークン経由のアクセス用ポリシー（匿名ユーザーがトークンで閲覧可能）
CREATE POLICY "Read own student token"
  ON public.lecture_scheduling_student_tokens FOR SELECT
  USING (true);

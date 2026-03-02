-- ============================================================
-- 039: 休館日テーブル
-- ============================================================

CREATE TABLE public.closed_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closed_date date NOT NULL UNIQUE,
  reason text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.closed_days ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザー読み取り可
CREATE POLICY "authenticated read closed_days" ON public.closed_days
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- admin のみ書き込み
CREATE POLICY "admin modify closed_days" ON public.closed_days
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE INDEX idx_closed_days_date ON public.closed_days(closed_date);

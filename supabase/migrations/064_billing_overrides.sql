-- 請求の金額上書き・除外テーブル
CREATE TABLE IF NOT EXISTS public.billing_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_type text NOT NULL CHECK (billing_type IN ('contract', 'lecture', 'material', 'manual')),
  ref_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  override_type text NOT NULL CHECK (override_type IN ('amount', 'exclude')),
  override_amount integer,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (billing_type, ref_id, year, month)
);

ALTER TABLE public.billing_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.billing_overrides FOR ALL USING (true) WITH CHECK (true);

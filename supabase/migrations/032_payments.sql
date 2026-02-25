-- 入金管理テーブル
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_type text NOT NULL CHECK (billing_type IN ('contract', 'lecture')),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  lecture_id uuid REFERENCES public.lectures(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  billed_amount integer NOT NULL DEFAULT 0,
  paid_amount integer NOT NULL DEFAULT 0,
  difference integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT '未入金' CHECK (status IN ('未入金', '入金済み', '過不足あり')),
  payment_date date,
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('振込', '口座振替')),
  followup_status text NOT NULL DEFAULT '' CHECK (followup_status IN ('', '対応不要', '振込依頼中', '対応済み')),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (billing_type = 'contract' AND contract_id IS NOT NULL AND lecture_id IS NULL) OR
    (billing_type = 'lecture' AND lecture_id IS NOT NULL AND contract_id IS NULL)
  )
);

-- ユニーク制約（月ごとに1件）
CREATE UNIQUE INDEX payments_contract_month_uniq
  ON public.payments (contract_id, year, month)
  WHERE contract_id IS NOT NULL;

CREATE UNIQUE INDEX payments_lecture_month_uniq
  ON public.payments (lecture_id, year, month)
  WHERE lecture_id IS NOT NULL;

-- 検索用インデックス
CREATE INDEX payments_year_month_idx ON public.payments (year, month);

-- updated_at トリガー
CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full access to payments" ON public.payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' = 'admin'
    )
  );

-- 生徒テーブルに支払方法カラム追加
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT '振込';

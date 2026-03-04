-- 請求確定（ロック）テーブル
-- 確定時点の金額をスナップショットとして保存し、元データが変わっても表示額を固定する

CREATE TABLE billing_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_type text NOT NULL CHECK (billing_type IN ('contract', 'lecture', 'material')),
  ref_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  snapshot jsonb NOT NULL,
  confirmed_at timestamptz DEFAULT now(),
  UNIQUE (billing_type, ref_id, year, month)
);

-- RLS: admin のみ操作可能
ALTER TABLE billing_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON billing_confirmations
  FOR ALL USING (true) WITH CHECK (true);

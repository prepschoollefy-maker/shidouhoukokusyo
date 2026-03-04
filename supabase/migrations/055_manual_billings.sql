-- 手動請求（直接請求）テーブル
CREATE TABLE public.manual_billings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_manual_billings_student ON public.manual_billings(student_id);
CREATE INDEX idx_manual_billings_ym ON public.manual_billings(year, month);

-- updated_at トリガー
CREATE TRIGGER set_manual_billings_updated_at
  BEFORE UPDATE ON public.manual_billings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS: admin only
ALTER TABLE public.manual_billings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin full access to manual_billings" ON public.manual_billings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' = 'admin'
    )
  );

-- payments テーブル拡張: billing_type に 'manual' を追加
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_billing_type_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_billing_type_check
  CHECK (billing_type IN ('contract', 'lecture', 'material', 'manual'));

-- manual_billing_id カラム追加
ALTER TABLE public.payments ADD COLUMN manual_billing_id uuid
  REFERENCES public.manual_billings(id) ON DELETE CASCADE;

-- 相互排他制約の更新
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_mutual_exclusivity;
ALTER TABLE public.payments ADD CONSTRAINT payments_mutual_exclusivity CHECK (
  (billing_type = 'contract' AND contract_id IS NOT NULL AND lecture_id IS NULL AND material_sale_id IS NULL AND manual_billing_id IS NULL) OR
  (billing_type = 'lecture' AND lecture_id IS NOT NULL AND contract_id IS NULL AND material_sale_id IS NULL AND manual_billing_id IS NULL) OR
  (billing_type = 'material' AND material_sale_id IS NOT NULL AND contract_id IS NULL AND lecture_id IS NULL AND manual_billing_id IS NULL) OR
  (billing_type = 'manual' AND manual_billing_id IS NOT NULL AND contract_id IS NULL AND lecture_id IS NULL AND material_sale_id IS NULL)
);

-- 手動請求のユニーク制約（月ごとに1件）
CREATE UNIQUE INDEX payments_manual_month_uniq
  ON public.payments (manual_billing_id, year, month)
  WHERE manual_billing_id IS NOT NULL;

-- billing_confirmations テーブル拡張: billing_type に 'manual' を追加
ALTER TABLE public.billing_confirmations DROP CONSTRAINT IF EXISTS billing_confirmations_billing_type_check;
ALTER TABLE public.billing_confirmations ADD CONSTRAINT billing_confirmations_billing_type_check
  CHECK (billing_type IN ('contract', 'lecture', 'material', 'manual'));

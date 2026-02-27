-- 教材販売テーブル
CREATE TABLE public.material_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  unit_price integer NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  total_amount integer NOT NULL DEFAULT 0,
  sale_date date NOT NULL,
  billing_year integer NOT NULL,
  billing_month integer NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: admin only
ALTER TABLE public.material_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin full access to material_sales" ON public.material_sales
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE INDEX idx_material_sales_student ON public.material_sales(student_id);
CREATE INDEX idx_material_sales_billing ON public.material_sales(billing_year, billing_month);

-- updated_at トリガー
CREATE TRIGGER set_material_sales_updated_at
  BEFORE UPDATE ON public.material_sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- payments テーブル拡張: billing_type に 'material' を追加
-- 既存の CHECK 制約を削除して再作成
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_billing_type_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_billing_type_check
  CHECK (billing_type IN ('contract', 'lecture', 'material'));

-- material_sale_id カラム追加
ALTER TABLE public.payments ADD COLUMN material_sale_id uuid
  REFERENCES public.material_sales(id) ON DELETE CASCADE;

-- 相互排他制約の更新（既存のインラインCHECKを削除して再作成）
-- PostgreSQLではインラインCHECK制約名は "テーブル名_check" or "テーブル名_check1" 等
-- pg_constraint から正確な名前を取得する必要があるが、
-- migration 032 のインラインCHECKは名前が自動生成される
-- 安全策: DO ブロックで動的に削除
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND contype = 'c'
      AND conname NOT IN ('payments_billing_type_check', 'payments_status_check', 'payments_payment_method_check', 'payments_followup_status_check')
      AND pg_get_constraintdef(oid) LIKE '%billing_type%contract_id%lecture_id%'
  LOOP
    EXECUTE 'ALTER TABLE public.payments DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.payments ADD CONSTRAINT payments_mutual_exclusivity CHECK (
  (billing_type = 'contract' AND contract_id IS NOT NULL AND lecture_id IS NULL AND material_sale_id IS NULL) OR
  (billing_type = 'lecture' AND lecture_id IS NOT NULL AND contract_id IS NULL AND material_sale_id IS NULL) OR
  (billing_type = 'material' AND material_sale_id IS NOT NULL AND contract_id IS NULL AND lecture_id IS NULL)
);

-- 教材販売のユニーク制約（月ごとに1件）
CREATE UNIQUE INDEX payments_material_month_uniq
  ON public.payments (material_sale_id, year, month)
  WHERE material_sale_id IS NOT NULL;

-- 契約削除時に ON DELETE SET NULL で contract_id が NULL になっても
-- CHECK制約に違反しないよう修正する。
-- 変更前: billing_type='contract' AND contract_id IS NOT NULL（削除元がないと違反）
-- 変更後: contract_id IS NULL の場合も許容（削除済み契約の入金記録を保持）

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_mutual_exclusivity;
ALTER TABLE public.payments ADD CONSTRAINT payments_mutual_exclusivity CHECK (
  (billing_type = 'contract'  AND (contract_id IS NOT NULL OR (lecture_id IS NULL AND material_sale_id IS NULL AND manual_billing_id IS NULL))) OR
  (billing_type = 'lecture'   AND (lecture_id IS NOT NULL   OR (contract_id IS NULL AND material_sale_id IS NULL AND manual_billing_id IS NULL))) OR
  (billing_type = 'material'  AND (material_sale_id IS NOT NULL OR (contract_id IS NULL AND lecture_id IS NULL AND manual_billing_id IS NULL))) OR
  (billing_type = 'manual'    AND (manual_billing_id IS NOT NULL OR (contract_id IS NULL AND lecture_id IS NULL AND material_sale_id IS NULL)))
);

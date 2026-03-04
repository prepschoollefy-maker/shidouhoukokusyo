-- payments: CASCADE → SET NULL に変更（契約・講習削除時に入金履歴を保持）
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_contract_id_fkey,
  DROP CONSTRAINT IF EXISTS payments_lecture_id_fkey;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD CONSTRAINT payments_lecture_id_fkey
    FOREIGN KEY (lecture_id) REFERENCES public.lectures(id) ON DELETE SET NULL;

-- adjustments: CASCADE → SET NULL に変更（契約・講習・教材削除時に返金履歴を保持）
ALTER TABLE public.adjustments
  DROP CONSTRAINT IF EXISTS adjustments_contract_id_fkey,
  DROP CONSTRAINT IF EXISTS adjustments_lecture_id_fkey,
  DROP CONSTRAINT IF EXISTS adjustments_material_sale_id_fkey;

ALTER TABLE public.adjustments
  ADD CONSTRAINT adjustments_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD CONSTRAINT adjustments_lecture_id_fkey
    FOREIGN KEY (lecture_id) REFERENCES public.lectures(id) ON DELETE SET NULL,
  ADD CONSTRAINT adjustments_material_sale_id_fkey
    FOREIGN KEY (material_sale_id) REFERENCES public.material_sales(id) ON DELETE SET NULL;

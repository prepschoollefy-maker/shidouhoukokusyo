-- adjustments テーブルに請求項目への紐付けカラムを追加
ALTER TABLE public.adjustments
  ADD COLUMN contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  ADD COLUMN lecture_id uuid REFERENCES public.lectures(id) ON DELETE CASCADE,
  ADD COLUMN material_sale_id uuid REFERENCES public.material_sales(id) ON DELETE CASCADE;

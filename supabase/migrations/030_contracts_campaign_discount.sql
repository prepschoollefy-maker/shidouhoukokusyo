-- 講習キャンペーン割引額カラム追加
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS campaign_discount integer NOT NULL DEFAULT 0;

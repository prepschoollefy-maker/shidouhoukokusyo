-- 入塾金カラム追加
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS enrollment_fee integer NOT NULL DEFAULT 0;

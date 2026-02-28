-- 口座振替開始年月カラム追加
-- 形式: "2026-05" など。NULLの場合は students.payment_method をそのまま使用
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS direct_debit_start_ym text DEFAULT NULL;

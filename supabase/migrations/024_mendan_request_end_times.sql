-- 面談希望日に終了時刻（〜何時）を追加
ALTER TABLE public.mendan_requests
  ADD COLUMN candidate1_end timestamptz,
  ADD COLUMN candidate2_end timestamptz,
  ADD COLUMN candidate3_end timestamptz;

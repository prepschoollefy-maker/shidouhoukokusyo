-- 面談希望申請に対応済フラグを追加
ALTER TABLE public.mendan_requests
  ADD COLUMN handled boolean NOT NULL DEFAULT false;

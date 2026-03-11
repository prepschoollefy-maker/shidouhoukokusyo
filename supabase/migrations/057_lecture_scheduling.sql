-- 講習日程調整機能

-- 1. 講習調整期間マスタ
CREATE TABLE public.lecture_scheduling_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,                          -- 例: '2026春期講習'
  start_date date NOT NULL,                     -- 講習開始日
  end_date date NOT NULL,                       -- 講習終了日
  student_token uuid NOT NULL DEFAULT gen_random_uuid(), -- 生徒用フォームURL
  student_deadline timestamptz,                 -- 生徒回答締切
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'confirmed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_lsp_student_token ON public.lecture_scheduling_periods (student_token);
CREATE TRIGGER set_lecture_scheduling_periods_updated_at
  BEFORE UPDATE ON public.lecture_scheduling_periods
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.lecture_scheduling_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on lecture_scheduling_periods"
  ON public.lecture_scheduling_periods FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- 2. 生徒の希望入力
CREATE TABLE public.lecture_scheduling_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.lecture_scheduling_periods(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subjects jsonb NOT NULL DEFAULT '{}',         -- {"算数": 3, "英語": 2, ...}
  note text,                                    -- 自由記入欄
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, student_id)
);
CREATE INDEX idx_lsr_period ON public.lecture_scheduling_requests (period_id);
CREATE TRIGGER set_lecture_scheduling_requests_updated_at
  BEFORE UPDATE ON public.lecture_scheduling_requests
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.lecture_scheduling_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on lecture_scheduling_requests"
  ON public.lecture_scheduling_requests FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- 3. 生徒のNG日時
CREATE TABLE public.lecture_scheduling_ng_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.lecture_scheduling_requests(id) ON DELETE CASCADE,
  ng_date date NOT NULL,
  time_slot_id uuid REFERENCES public.time_slots(id) ON DELETE CASCADE,  -- NULLなら終日NG
  UNIQUE (request_id, ng_date, time_slot_id)
);
CREATE INDEX idx_lsng_request ON public.lecture_scheduling_ng_slots (request_id);

ALTER TABLE public.lecture_scheduling_ng_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on lecture_scheduling_ng_slots"
  ON public.lecture_scheduling_ng_slots FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- 4. 講師アサイン（講師ごとにトークン生成）
CREATE TABLE public.lecture_scheduling_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.lecture_scheduling_requests(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'responded', 'confirmed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, teacher_id)
);
CREATE UNIQUE INDEX idx_lsa_token ON public.lecture_scheduling_assignments (token);
CREATE INDEX idx_lsa_request ON public.lecture_scheduling_assignments (request_id);
CREATE TRIGGER set_lecture_scheduling_assignments_updated_at
  BEFORE UPDATE ON public.lecture_scheduling_assignments
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.lecture_scheduling_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on lecture_scheduling_assignments"
  ON public.lecture_scheduling_assignments FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- 5. 講師の回答（担当可能なコマ）
CREATE TABLE public.lecture_scheduling_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.lecture_scheduling_assignments(id) ON DELETE CASCADE,
  available_date date NOT NULL,
  time_slot_id uuid NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, available_date, time_slot_id)
);
CREATE INDEX idx_lsresp_assignment ON public.lecture_scheduling_responses (assignment_id);

ALTER TABLE public.lecture_scheduling_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on lecture_scheduling_responses"
  ON public.lecture_scheduling_responses FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

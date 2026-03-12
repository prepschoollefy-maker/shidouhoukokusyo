-- 講習日程の確定データ（生徒×日時×講師×科目）
CREATE TABLE public.lecture_scheduling_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.lecture_scheduling_requests(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.lecture_scheduling_assignments(id) ON DELETE CASCADE,
  confirmed_date date NOT NULL,
  time_slot_id uuid NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  subject text NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, confirmed_date, time_slot_id)
);

CREATE INDEX idx_lsc_request ON public.lecture_scheduling_confirmations (request_id);

ALTER TABLE public.lecture_scheduling_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on lecture_scheduling_confirmations"
  ON public.lecture_scheduling_confirmations FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE TABLE public.summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id),
  subject_id uuid REFERENCES public.subjects(id),
  status text NOT NULL DEFAULT 'unchecked' CHECK (status IN ('unchecked', 'approved', 'sent', 'on_hold')),
  content text NOT NULL DEFAULT '',
  period_start date NOT NULL,
  period_end date NOT NULL,
  auto_send_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER summaries_updated_at
  BEFORE UPDATE ON public.summaries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.summary_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id uuid NOT NULL REFERENCES public.summaries(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.lesson_reports(id) ON DELETE CASCADE,
  UNIQUE(summary_id, report_id)
);

ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summary_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.summaries
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "admin_full_access" ON public.summary_reports
  FOR ALL USING (public.get_user_role() = 'admin');

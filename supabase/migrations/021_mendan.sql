-- mendan_tokens: 保護者に送るトークン管理
CREATE TABLE public.mendan_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  period_label text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mendan_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_access" ON public.mendan_tokens FOR ALL USING (public.get_user_role() = 'admin');

-- mendan_requests: 保護者の面談希望日（候補3つ）
CREATE TABLE public.mendan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.mendan_tokens(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  candidate1 timestamptz NOT NULL,
  candidate2 timestamptz NOT NULL,
  candidate3 timestamptz NOT NULL,
  message text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mendan_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_access" ON public.mendan_requests FOR ALL USING (public.get_user_role() = 'admin');

-- mendan_records: 面談内容記録（管理者が記入）
CREATE TABLE public.mendan_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  mendan_date date NOT NULL,
  attendees text,
  content text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER mendan_records_updated_at BEFORE UPDATE ON public.mendan_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.mendan_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_access" ON public.mendan_records FOR ALL USING (public.get_user_role() = 'admin');

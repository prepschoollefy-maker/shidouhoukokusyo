CREATE TABLE public.textbook_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.textbook_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON public.textbook_suggestions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_manage" ON public.textbook_suggestions
  FOR ALL USING (public.get_user_role() = 'admin');

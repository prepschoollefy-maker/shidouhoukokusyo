CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON public.subjects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_manage" ON public.subjects
  FOR ALL USING (public.get_user_role() = 'admin');

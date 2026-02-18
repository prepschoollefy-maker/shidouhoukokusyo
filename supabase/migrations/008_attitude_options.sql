CREATE TABLE public.attitude_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  category text NOT NULL CHECK (category IN ('positive', 'negative')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attitude_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON public.attitude_options
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_manage" ON public.attitude_options
  FOR ALL USING (public.get_user_role() = 'admin');

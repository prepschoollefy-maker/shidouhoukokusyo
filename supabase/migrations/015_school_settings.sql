CREATE TABLE public.school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL DEFAULT 'レフィー',
  email_signature text DEFAULT E'---\n個別指導塾レフィー',
  default_summary_frequency integer NOT NULL DEFAULT 4,
  auto_send_wait_hours integer NOT NULL DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER school_settings_updated_at
  BEFORE UPDATE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON public.school_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_manage" ON public.school_settings
  FOR ALL USING (public.get_user_role() = 'admin');

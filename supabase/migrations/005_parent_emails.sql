CREATE TABLE public.parent_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  email text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_emails ENABLE ROW LEVEL SECURITY;

-- Admin only - teachers cannot see parent emails
CREATE POLICY "admin_full_access" ON public.parent_emails
  FOR ALL USING (public.get_user_role() = 'admin');

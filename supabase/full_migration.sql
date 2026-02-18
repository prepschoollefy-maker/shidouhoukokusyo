-- ============================================================
-- Full Migration + Seed for Supabase SQL Editor
-- Fixed order: tables first, then functions/policies
-- ============================================================

-- ============================
-- PART 1: Trigger helper (no table dependency)
-- ============================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================
-- PART 2: All tables (no RLS yet)
-- ============================

CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role text NOT NULL DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher')),
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  grade text,
  summary_frequency integer NOT NULL DEFAULT 4,
  send_mode text NOT NULL DEFAULT 'manual' CHECK (send_mode IN ('manual', 'auto_send')),
  weekly_lesson_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.parent_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  email text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  UNIQUE(student_id, subject_id)
);

CREATE TABLE public.teacher_student_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, student_id, subject_id)
);

CREATE TABLE public.attitude_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  category text NOT NULL CHECK (category IN ('positive', 'negative')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.textbook_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lesson_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id),
  student_id uuid NOT NULL REFERENCES public.students(id),
  subject_id uuid NOT NULL REFERENCES public.subjects(id),
  lesson_date date NOT NULL,
  unit_covered text NOT NULL,
  homework_check text NOT NULL CHECK (homework_check IN ('done', 'partial', 'not_done')),
  free_comment text,
  homework_assigned text NOT NULL,
  next_lesson_plan text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER lesson_reports_updated_at
  BEFORE UPDATE ON public.lesson_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.report_textbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.lesson_reports(id) ON DELETE CASCADE,
  textbook_name text NOT NULL,
  pages text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.report_attitudes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.lesson_reports(id) ON DELETE CASCADE,
  attitude_option_id uuid NOT NULL REFERENCES public.attitude_options(id) ON DELETE CASCADE,
  UNIQUE(report_id, attitude_option_id)
);

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

CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id uuid REFERENCES public.summaries(id),
  student_id uuid NOT NULL REFERENCES public.students(id),
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz DEFAULT now(),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

-- ============================
-- PART 3: Helper functions (tables exist now)
-- ============================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_student_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT student_id FROM public.teacher_student_assignments WHERE teacher_id = auth.uid();
$$;

-- ============================
-- PART 4: Auth triggers
-- ============================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', '')
  );
  UPDATE auth.users SET raw_app_meta_data =
    raw_app_meta_data || jsonb_build_object('role', COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'))
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_role_to_app_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    UPDATE auth.users SET raw_app_meta_data =
      raw_app_meta_data || jsonb_build_object('role', NEW.role)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_app_metadata();

-- ============================
-- PART 5: Enable RLS on all tables
-- ============================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_student_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attitude_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.textbook_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_textbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_attitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summary_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- ============================
-- PART 6: RLS Policies
-- ============================

-- profiles
CREATE POLICY "admin_full_access" ON public.profiles
  FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "users_read_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- subjects
CREATE POLICY "authenticated_read" ON public.subjects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage" ON public.subjects
  FOR ALL USING (public.get_user_role() = 'admin');

-- students
CREATE POLICY "admin_full_access" ON public.students
  FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "teacher_read_all" ON public.students
  FOR SELECT USING (public.get_user_role() = 'teacher');

-- parent_emails (admin only)
CREATE POLICY "admin_full_access" ON public.parent_emails
  FOR ALL USING (public.get_user_role() = 'admin');

-- student_subjects
CREATE POLICY "admin_full_access" ON public.student_subjects
  FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "teacher_read_all" ON public.student_subjects
  FOR SELECT USING (public.get_user_role() = 'teacher');

-- teacher_student_assignments
CREATE POLICY "admin_full_access" ON public.teacher_student_assignments
  FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "teacher_read_all" ON public.teacher_student_assignments
  FOR SELECT USING (public.get_user_role() = 'teacher');

-- attitude_options
CREATE POLICY "authenticated_read" ON public.attitude_options
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage" ON public.attitude_options
  FOR ALL USING (public.get_user_role() = 'admin');

-- textbook_suggestions
CREATE POLICY "authenticated_read" ON public.textbook_suggestions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage" ON public.textbook_suggestions
  FOR ALL USING (public.get_user_role() = 'admin');

-- lesson_reports
CREATE POLICY "admin_full_access" ON public.lesson_reports
  FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "teacher_read_own_and_assigned" ON public.lesson_reports
  FOR SELECT USING (
    public.get_user_role() = 'teacher'
    AND (
      teacher_id = auth.uid()
      OR student_id IN (SELECT public.get_teacher_student_ids())
    )
  );
CREATE POLICY "teacher_insert_own" ON public.lesson_reports
  FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "teacher_update_own_recent" ON public.lesson_reports
  FOR UPDATE USING (
    teacher_id = auth.uid()
    AND created_at > now() - interval '24 hours'
  ) WITH CHECK (
    teacher_id = auth.uid()
  );

-- report_textbooks
CREATE POLICY "admin_full_access" ON public.report_textbooks
  FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "teacher_read" ON public.report_textbooks
  FOR SELECT USING (
    report_id IN (
      SELECT id FROM public.lesson_reports
      WHERE teacher_id = auth.uid()
        OR student_id IN (SELECT public.get_teacher_student_ids())
    )
  );
CREATE POLICY "teacher_insert" ON public.report_textbooks
  FOR INSERT WITH CHECK (
    report_id IN (
      SELECT id FROM public.lesson_reports WHERE teacher_id = auth.uid()
    )
  );
CREATE POLICY "teacher_update" ON public.report_textbooks
  FOR UPDATE USING (
    report_id IN (
      SELECT id FROM public.lesson_reports
      WHERE teacher_id = auth.uid() AND created_at > now() - interval '24 hours'
    )
  );

-- report_attitudes
CREATE POLICY "admin_full_access" ON public.report_attitudes
  FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "teacher_read" ON public.report_attitudes
  FOR SELECT USING (
    report_id IN (
      SELECT id FROM public.lesson_reports
      WHERE teacher_id = auth.uid()
        OR student_id IN (SELECT public.get_teacher_student_ids())
    )
  );
CREATE POLICY "teacher_insert" ON public.report_attitudes
  FOR INSERT WITH CHECK (
    report_id IN (
      SELECT id FROM public.lesson_reports WHERE teacher_id = auth.uid()
    )
  );

-- summaries
CREATE POLICY "admin_full_access" ON public.summaries
  FOR ALL USING (public.get_user_role() = 'admin');

-- summary_reports
CREATE POLICY "admin_full_access" ON public.summary_reports
  FOR ALL USING (public.get_user_role() = 'admin');

-- email_logs
CREATE POLICY "admin_full_access" ON public.email_logs
  FOR ALL USING (public.get_user_role() = 'admin');

-- school_settings
CREATE POLICY "authenticated_read" ON public.school_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage" ON public.school_settings
  FOR ALL USING (public.get_user_role() = 'admin');

-- ============================
-- PART 7: Seed data
-- ============================

INSERT INTO public.subjects (name, sort_order) VALUES
  ('数学', 1),
  ('英語', 2),
  ('国語', 3),
  ('理科', 4),
  ('社会', 5);

INSERT INTO public.attitude_options (label, category, sort_order) VALUES
  ('集中できていた', 'positive', 1),
  ('自分から質問した', 'positive', 2),
  ('前回より改善が見られた', 'positive', 3),
  ('意欲的だった', 'positive', 4),
  ('ノートを丁寧に書いていた', 'positive', 5);

INSERT INTO public.attitude_options (label, category, sort_order) VALUES
  ('集中が切れやすかった', 'negative', 1),
  ('眠そうだった', 'negative', 2),
  ('問題を解くのを嫌がった', 'negative', 3),
  ('同じミスを繰り返した', 'negative', 4);

INSERT INTO public.school_settings (school_name, email_signature, default_summary_frequency, auto_send_wait_hours)
VALUES ('レフィー', E'---\n個別指導塾レフィー\nお問い合わせはお気軽にどうぞ。', 4, 24);

-- ============================================================
-- 037: 授業管理テーブル群
-- ============================================================

-- 1. time_slots — 時間枠マスタ（1限〜6限）
CREATE TABLE public.time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number integer NOT NULL UNIQUE,
  label text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
-- 全認証ユーザー読み取り可
CREATE POLICY "authenticated read time_slots" ON public.time_slots
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- admin のみ変更可
CREATE POLICY "admin modify time_slots" ON public.time_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' = 'admin'
    )
  );

-- シードデータ: 6コマ
INSERT INTO public.time_slots (slot_number, label, start_time, end_time, sort_order) VALUES
  (1, '1限', '12:30', '13:50', 1),
  (2, '2限', '14:00', '15:20', 2),
  (3, '3限', '15:30', '16:50', 3),
  (4, '4限', '17:00', '18:20', 4),
  (5, '5限', '18:30', '19:50', 5),
  (6, '6限', '20:00', '21:20', 6);

-- 2. slot_availability — 開講パターンマスタ
CREATE TABLE public.slot_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_slot_id uuid NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  day_type text NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday', 'intensive')),
  availability text NOT NULL DEFAULT 'closed' CHECK (availability IN ('open', 'closed', 'priority')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (time_slot_id, day_type)
);

ALTER TABLE public.slot_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read slot_availability" ON public.slot_availability
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin modify slot_availability" ON public.slot_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' = 'admin'
    )
  );

-- シードデータ: 要件定義書の開講パターン（6コマ×4曜日種別=24レコード）
INSERT INTO public.slot_availability (time_slot_id, day_type, availability)
SELECT ts.id, v.day_type, v.availability
FROM public.time_slots ts
JOIN (VALUES
  (1, 'weekday',   'closed'),
  (1, 'saturday',  'closed'),
  (1, 'sunday',    'open'),
  (1, 'intensive', 'open'),
  (2, 'weekday',   'closed'),
  (2, 'saturday',  'open'),
  (2, 'sunday',    'open'),
  (2, 'intensive', 'open'),
  (3, 'weekday',   'closed'),
  (3, 'saturday',  'open'),
  (3, 'sunday',    'open'),
  (3, 'intensive', 'open'),
  (4, 'weekday',   'open'),
  (4, 'saturday',  'open'),
  (4, 'sunday',    'open'),
  (4, 'intensive', 'priority'),
  (5, 'weekday',   'open'),
  (5, 'saturday',  'open'),
  (5, 'sunday',    'open'),
  (5, 'intensive', 'priority'),
  (6, 'weekday',   'open'),
  (6, 'saturday',  'open'),
  (6, 'sunday',    'closed'),
  (6, 'intensive', 'priority')
) AS v(slot_num, day_type, availability) ON ts.slot_number = v.slot_num;

-- 3. booths — ブースマスタ
CREATE TABLE public.booths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booth_number integer NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read booths" ON public.booths
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin modify booths" ON public.booths
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' = 'admin'
    )
  );

-- シードデータ: 15ブース
INSERT INTO public.booths (booth_number, label, sort_order)
SELECT n, 'ブース' || n, n
FROM generate_series(1, 15) AS n;

-- 4. instructor_shifts — 講師シフト
CREATE TABLE public.instructor_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  time_slot_id uuid NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  shift_type text NOT NULL CHECK (shift_type IN ('regular', 'specific')),
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
  specific_date date,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- regular時はday_of_week必須・specific_date不可、specific時はその逆
  CONSTRAINT instructor_shifts_type_check CHECK (
    (shift_type = 'regular' AND day_of_week IS NOT NULL AND specific_date IS NULL) OR
    (shift_type = 'specific' AND specific_date IS NOT NULL AND day_of_week IS NULL)
  )
);

ALTER TABLE public.instructor_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin full access instructor_shifts" ON public.instructor_shifts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' = 'admin'
    )
  );
CREATE POLICY "teacher read own shifts" ON public.instructor_shifts
  FOR SELECT USING (teacher_id = auth.uid());

CREATE INDEX idx_instructor_shifts_teacher ON public.instructor_shifts(teacher_id);
CREATE INDEX idx_instructor_shifts_date ON public.instructor_shifts(specific_date) WHERE specific_date IS NOT NULL;

-- regular重複防止
CREATE UNIQUE INDEX idx_instructor_shifts_regular_uniq
  ON public.instructor_shifts(teacher_id, time_slot_id, day_of_week)
  WHERE shift_type = 'regular';

-- specific重複防止
CREATE UNIQUE INDEX idx_instructor_shifts_specific_uniq
  ON public.instructor_shifts(teacher_id, time_slot_id, specific_date)
  WHERE shift_type = 'specific';

CREATE TRIGGER set_instructor_shifts_updated_at
  BEFORE UPDATE ON public.instructor_shifts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. regular_lesson_templates — 通常授業テンプレート
CREATE TABLE public.regular_lesson_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_slot_id uuid NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  booth_id uuid REFERENCES public.booths(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 同一生徒は同時間に1授業のみ
  UNIQUE (student_id, day_of_week, time_slot_id)
);

ALTER TABLE public.regular_lesson_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin full access regular_lesson_templates" ON public.regular_lesson_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' = 'admin'
    )
  );
CREATE POLICY "teacher read own templates" ON public.regular_lesson_templates
  FOR SELECT USING (teacher_id = auth.uid());

CREATE INDEX idx_templates_student ON public.regular_lesson_templates(student_id);
CREATE INDEX idx_templates_teacher ON public.regular_lesson_templates(teacher_id);

-- 講師は同時間に1授業のみ（active時）
CREATE UNIQUE INDEX idx_templates_teacher_slot_uniq
  ON public.regular_lesson_templates(teacher_id, day_of_week, time_slot_id)
  WHERE is_active = true;

-- ブースは同時間に1授業のみ（active時）
CREATE UNIQUE INDEX idx_templates_booth_slot_uniq
  ON public.regular_lesson_templates(booth_id, day_of_week, time_slot_id)
  WHERE is_active = true AND booth_id IS NOT NULL;

CREATE TRIGGER set_regular_lesson_templates_updated_at
  BEFORE UPDATE ON public.regular_lesson_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. lessons — 授業インスタンス
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  lesson_date date NOT NULL,
  time_slot_id uuid NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  booth_id uuid REFERENCES public.booths(id) ON DELETE SET NULL,
  lesson_type text NOT NULL CHECK (lesson_type IN ('regular', 'intensive', 'makeup')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  template_id uuid REFERENCES public.regular_lesson_templates(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin full access lessons" ON public.lessons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' = 'admin'
    )
  );
CREATE POLICY "teacher read own lessons" ON public.lessons
  FOR SELECT USING (teacher_id = auth.uid());

CREATE INDEX idx_lessons_student ON public.lessons(student_id);
CREATE INDEX idx_lessons_teacher ON public.lessons(teacher_id);
CREATE INDEX idx_lessons_date ON public.lessons(lesson_date);
CREATE INDEX idx_lessons_template ON public.lessons(template_id) WHERE template_id IS NOT NULL;

-- 生徒は同日同時間に1授業のみ（cancelled/rescheduled除外）
CREATE UNIQUE INDEX idx_lessons_student_slot_uniq
  ON public.lessons(student_id, lesson_date, time_slot_id)
  WHERE status NOT IN ('cancelled', 'rescheduled');

-- 講師は同日同時間に1授業のみ（cancelled/rescheduled除外）
CREATE UNIQUE INDEX idx_lessons_teacher_slot_uniq
  ON public.lessons(teacher_id, lesson_date, time_slot_id)
  WHERE status NOT IN ('cancelled', 'rescheduled');

-- ブースは同日同時間に1授業のみ（cancelled/rescheduled除外）
CREATE UNIQUE INDEX idx_lessons_booth_slot_uniq
  ON public.lessons(booth_id, lesson_date, time_slot_id)
  WHERE status NOT IN ('cancelled', 'rescheduled') AND booth_id IS NOT NULL;

CREATE TRIGGER set_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. reschedule_requests — 振替申請
CREATE TABLE public.reschedule_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  requested_by text NOT NULL,
  reason text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  new_lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  responded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reschedule_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin full access reschedule_requests" ON public.reschedule_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE INDEX idx_reschedule_lesson ON public.reschedule_requests(lesson_id);
CREATE INDEX idx_reschedule_status ON public.reschedule_requests(status) WHERE status = 'pending';

-- ============================================================
-- 既存テーブル変更: lesson_reports に lesson_id を追加
-- ============================================================
ALTER TABLE public.lesson_reports
  ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL;

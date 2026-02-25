-- 講習（スポット受講）管理テーブル
CREATE TABLE public.lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (label IN ('春期','夏期','冬期','受験直前特訓','その他')),
  grade text NOT NULL,
  courses jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at 自動更新トリガー
CREATE TRIGGER set_lectures_updated_at
  BEFORE UPDATE ON public.lectures
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on lectures"
  ON public.lectures FOR ALL
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- インデックス
CREATE INDEX idx_lectures_student_id ON public.lectures(student_id);

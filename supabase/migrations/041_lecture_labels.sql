-- 講習ラベルマスタテーブル
CREATE TABLE public.lecture_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 既存5ラベルをシード
INSERT INTO public.lecture_labels (label, sort_order) VALUES
  ('春期', 0),
  ('夏期', 1),
  ('冬期', 2),
  ('受験直前特訓', 3),
  ('その他', 4);

-- RLS
ALTER TABLE public.lecture_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on lecture_labels"
  ON public.lecture_labels FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- lectures テーブルの CHECK 制約を削除（動的ラベルを許可）
ALTER TABLE public.lectures DROP CONSTRAINT IF EXISTS lectures_label_check;

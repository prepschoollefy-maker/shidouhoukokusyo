-- 返金・調整テーブル
CREATE TABLE public.adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id),
  year integer NOT NULL,
  month integer NOT NULL,
  amount integer NOT NULL,         -- マイナス=返金、プラス=追加請求
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '未対応' CHECK (status IN ('未対応', '対応済み')),
  completed_date date,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_adjustments_year_month ON public.adjustments(year, month);

-- RLS: admin only（material_sales と同じパターン）
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin full access" ON public.adjustments FOR ALL
  USING (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'));

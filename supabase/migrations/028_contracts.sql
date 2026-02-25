-- 契約管理テーブル
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  contract_no text,
  type text NOT NULL DEFAULT 'initial' CHECK (type IN ('initial', 'renewal')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  grade text NOT NULL,
  courses jsonb NOT NULL DEFAULT '[]'::jsonb,
  monthly_amount integer NOT NULL DEFAULT 0,
  staff_name text DEFAULT '',
  notes text DEFAULT '',
  campaign text,
  prev_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.contracts
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "teacher_read_assigned" ON public.contracts
  FOR SELECT USING (
    public.get_user_role() = 'teacher'
    AND student_id IN (SELECT public.get_teacher_student_ids())
  );

CREATE INDEX idx_contracts_student_id ON public.contracts(student_id);
CREATE INDEX idx_contracts_dates ON public.contracts(start_date, end_date);

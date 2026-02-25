ALTER TABLE public.students ADD COLUMN student_number text;
CREATE UNIQUE INDEX students_student_number_unique
  ON public.students (student_number) WHERE student_number IS NOT NULL;

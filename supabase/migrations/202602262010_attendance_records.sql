BEGIN;

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_student_class_date_key
  ON public.attendance_records (student_id, class_group_id, date);

CREATE INDEX IF NOT EXISTS attendance_records_class_date_idx
  ON public.attendance_records (class_group_id, date);

CREATE INDEX IF NOT EXISTS attendance_records_teacher_date_idx
  ON public.attendance_records (teacher_id, date);

DROP TRIGGER IF EXISTS set_attendance_records_updated_at ON public.attendance_records;
CREATE TRIGGER set_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;

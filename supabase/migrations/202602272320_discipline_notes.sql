BEGIN;

CREATE TABLE IF NOT EXISTS public.discipline_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date date NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discipline_notes_student_date_idx
  ON public.discipline_notes (student_id, date DESC);

CREATE INDEX IF NOT EXISTS discipline_notes_school_year_teacher_idx
  ON public.discipline_notes (school_id, academic_year_id, teacher_user_id);

DO $$
BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger WHERE tgname = 'set_discipline_notes_updated_at'
     ) THEN
    CREATE TRIGGER set_discipline_notes_updated_at
      BEFORE UPDATE ON public.discipline_notes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

ALTER TABLE public.discipline_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'discipline_notes'
      AND policyname = 'discipline_notes_select_own'
  ) THEN
    CREATE POLICY discipline_notes_select_own
      ON public.discipline_notes
      FOR SELECT
      USING (teacher_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'discipline_notes'
      AND policyname = 'discipline_notes_insert_own'
  ) THEN
    CREATE POLICY discipline_notes_insert_own
      ON public.discipline_notes
      FOR INSERT
      WITH CHECK (teacher_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'discipline_notes'
      AND policyname = 'discipline_notes_update_own'
  ) THEN
    CREATE POLICY discipline_notes_update_own
      ON public.discipline_notes
      FOR UPDATE
      USING (teacher_user_id = auth.uid())
      WITH CHECK (teacher_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'discipline_notes'
      AND policyname = 'discipline_notes_delete_own'
  ) THEN
    CREATE POLICY discipline_notes_delete_own
      ON public.discipline_notes
      FOR DELETE
      USING (teacher_user_id = auth.uid());
  END IF;
END
$$;

COMMIT;

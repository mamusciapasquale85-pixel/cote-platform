BEGIN;

CREATE TABLE IF NOT EXISTS public.discipline_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  teacher_id uuid,
  class_group_id uuid NULL REFERENCES public.class_groups(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discipline_notes
  ADD COLUMN IF NOT EXISTS teacher_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'discipline_notes_teacher_id_fkey'
  ) THEN
    ALTER TABLE public.discipline_notes
      ADD CONSTRAINT discipline_notes_teacher_id_fkey
      FOREIGN KEY (teacher_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

ALTER TABLE public.discipline_notes
  ADD COLUMN IF NOT EXISTS class_group_id uuid NULL REFERENCES public.class_groups(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'discipline_notes'
      AND column_name = 'teacher_user_id'
  ) THEN
    EXECUTE 'UPDATE public.discipline_notes SET teacher_id = COALESCE(teacher_id, teacher_user_id)';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.discipline_notes WHERE teacher_id IS NULL) THEN
    RAISE NOTICE 'discipline_notes.teacher_id contains NULL values; keeping column nullable for now';
  ELSE
    ALTER TABLE public.discipline_notes ALTER COLUMN teacher_id SET NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS discipline_notes_student_date_idx
  ON public.discipline_notes (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS discipline_notes_school_year_teacher_idx
  ON public.discipline_notes (school_id, academic_year_id, teacher_id);

CREATE INDEX IF NOT EXISTS discipline_notes_class_idx
  ON public.discipline_notes (class_group_id);

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

DROP POLICY IF EXISTS discipline_notes_select_own ON public.discipline_notes;
DROP POLICY IF EXISTS discipline_notes_insert_own ON public.discipline_notes;
DROP POLICY IF EXISTS discipline_notes_update_own ON public.discipline_notes;
DROP POLICY IF EXISTS discipline_notes_delete_own ON public.discipline_notes;

CREATE POLICY discipline_notes_select_own
  ON public.discipline_notes
  FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY discipline_notes_insert_own
  ON public.discipline_notes
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY discipline_notes_update_own
  ON public.discipline_notes
  FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY discipline_notes_delete_own
  ON public.discipline_notes
  FOR DELETE
  USING (teacher_id = auth.uid());

COMMIT;

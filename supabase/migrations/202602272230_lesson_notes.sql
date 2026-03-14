BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  slot int NOT NULL,
  class_group_id uuid NULL REFERENCES public.class_groups(id) ON DELETE SET NULL,
  lesson_title text NULL,
  plan text NULL,
  comments text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_notes
  DROP CONSTRAINT IF EXISTS lesson_notes_slot_check;

ALTER TABLE public.lesson_notes
  ADD CONSTRAINT lesson_notes_slot_check
  CHECK (slot BETWEEN 1 AND 10);

CREATE UNIQUE INDEX IF NOT EXISTS lesson_notes_teacher_date_slot_uniq
  ON public.lesson_notes (teacher_user_id, date, slot);

CREATE INDEX IF NOT EXISTS lesson_notes_teacher_date_idx
  ON public.lesson_notes (teacher_user_id, date);

DO $$
BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger WHERE tgname = 'set_lesson_notes_updated_at'
     ) THEN
    CREATE TRIGGER set_lesson_notes_updated_at
      BEFORE UPDATE ON public.lesson_notes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS public.teacher_timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week int NOT NULL,
  slot int NOT NULL,
  class_group_id uuid NULL REFERENCES public.class_groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_timetable_slots
  DROP CONSTRAINT IF EXISTS teacher_timetable_slots_day_of_week_check;

ALTER TABLE public.teacher_timetable_slots
  ADD CONSTRAINT teacher_timetable_slots_day_of_week_check
  CHECK (day_of_week BETWEEN 1 AND 7);

ALTER TABLE public.teacher_timetable_slots
  DROP CONSTRAINT IF EXISTS teacher_timetable_slots_slot_check;

ALTER TABLE public.teacher_timetable_slots
  ADD CONSTRAINT teacher_timetable_slots_slot_check
  CHECK (slot BETWEEN 1 AND 10);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_timetable_slots_uniq
  ON public.teacher_timetable_slots (teacher_user_id, academic_year_id, day_of_week, slot);

CREATE INDEX IF NOT EXISTS teacher_timetable_slots_school_year_teacher_idx
  ON public.teacher_timetable_slots (school_id, academic_year_id, teacher_user_id);

DO $$
BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger WHERE tgname = 'set_teacher_timetable_slots_updated_at'
     ) THEN
    CREATE TRIGGER set_teacher_timetable_slots_updated_at
      BEFORE UPDATE ON public.teacher_timetable_slots
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

COMMIT;

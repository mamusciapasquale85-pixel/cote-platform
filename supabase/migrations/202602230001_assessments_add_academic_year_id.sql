-- Add academic_year_id to assessments and backfill existing rows.
-- Safe to run multiple times.

BEGIN;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS academic_year_id uuid;

-- 1) Backfill from class_groups when possible.
UPDATE public.assessments AS a
SET academic_year_id = cg.academic_year_id
FROM public.class_groups AS cg
WHERE a.academic_year_id IS NULL
  AND a.class_group_id = cg.id
  AND cg.academic_year_id IS NOT NULL;

-- 2) Backfill from courses when that column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'academic_year_id'
  ) THEN
    UPDATE public.assessments AS a
    SET academic_year_id = c.academic_year_id
    FROM public.courses AS c
    WHERE a.academic_year_id IS NULL
      AND a.course_id = c.id
      AND c.academic_year_id IS NOT NULL;
  END IF;
END
$$;

-- 3) Final fallback: latest academic year by school.
UPDATE public.assessments AS a
SET academic_year_id = ay.id
FROM LATERAL (
  SELECT ay2.id
  FROM public.academic_years AS ay2
  WHERE ay2.school_id = a.school_id
  ORDER BY ay2.created_at DESC, ay2.id DESC
  LIMIT 1
) AS ay
WHERE a.academic_year_id IS NULL;

-- Add FK only once.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assessments_academic_year_id_fkey'
  ) THEN
    ALTER TABLE public.assessments
      ADD CONSTRAINT assessments_academic_year_id_fkey
      FOREIGN KEY (academic_year_id)
      REFERENCES public.academic_years(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

-- Helpful indexes for teacher/year scoped queries.
CREATE INDEX IF NOT EXISTS assessments_school_year_teacher_date_idx
  ON public.assessments (school_id, academic_year_id, teacher_user_id, date DESC);

CREATE INDEX IF NOT EXISTS assessments_academic_year_id_idx
  ON public.assessments (academic_year_id);

-- Enforce integrity when backfill is complete.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.assessments
    WHERE academic_year_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL on assessments.academic_year_id: some rows could not be backfilled.';
  END IF;

  ALTER TABLE public.assessments
    ALTER COLUMN academic_year_id SET NOT NULL;
END
$$;

COMMIT;

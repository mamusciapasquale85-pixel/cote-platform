BEGIN;

CREATE TABLE IF NOT EXISTS public.apprentissages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS apprentissages_school_year_name_key
  ON public.apprentissages (school_id, academic_year_id, name);

CREATE INDEX IF NOT EXISTS apprentissages_school_year_order_idx
  ON public.apprentissages (school_id, academic_year_id, order_index);

DROP TRIGGER IF EXISTS set_apprentissages_updated_at ON public.apprentissages;
CREATE TRIGGER set_apprentissages_updated_at
  BEFORE UPDATE ON public.apprentissages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS apprentissage_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assessments_apprentissage_id_fkey'
  ) THEN
    ALTER TABLE public.assessments
      ADD CONSTRAINT assessments_apprentissage_id_fkey
      FOREIGN KEY (apprentissage_id)
      REFERENCES public.apprentissages(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS assessments_school_apprentissage_idx
  ON public.assessments (school_id, apprentissage_id);

COMMIT;

BEGIN;

DO $$
DECLARE
  slot_type text;
BEGIN
  SELECT data_type
    INTO slot_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'agenda_items'
    AND column_name = 'slot';

  IF slot_type IS NULL THEN
    ALTER TABLE public.agenda_items ADD COLUMN slot integer;
  ELSIF slot_type = 'text' THEN
    ALTER TABLE public.agenda_items
      ALTER COLUMN slot TYPE integer
      USING CASE
        WHEN slot IS NULL OR btrim(slot) = '' THEN NULL
        WHEN upper(btrim(slot)) ~ '^P(10|[1-9])$' THEN regexp_replace(upper(btrim(slot)), '^P', '')::integer
        WHEN btrim(slot) ~ '^(10|[1-9])$' THEN btrim(slot)::integer
        ELSE NULL
      END;
  END IF;
END
$$;

ALTER TABLE public.agenda_items
  DROP CONSTRAINT IF EXISTS agenda_items_slot_check;

ALTER TABLE public.agenda_items
  ADD CONSTRAINT agenda_items_slot_check
  CHECK (slot IS NULL OR (slot BETWEEN 1 AND 10));

ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS lesson_title text NULL;

ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS tag text NULL;

UPDATE public.agenda_items
SET tag = lower(btrim(tag))
WHERE tag IS NOT NULL;

ALTER TABLE public.agenda_items
  DROP CONSTRAINT IF EXISTS agenda_items_tag_check;

ALTER TABLE public.agenda_items
  ADD CONSTRAINT agenda_items_tag_check
  CHECK (tag IS NULL OR tag IN ('eval', 'devoir'));

CREATE INDEX IF NOT EXISTS agenda_items_teacher_date_slot_idx
  ON public.agenda_items (teacher_id, date, slot);

CREATE INDEX IF NOT EXISTS agenda_items_school_year_teacher_date_slot_idx
  ON public.agenda_items (school_id, academic_year_id, teacher_id, date, slot);

CREATE INDEX IF NOT EXISTS agenda_items_class_date_slot_idx
  ON public.agenda_items (class_group_id, date, slot);

DO $$
BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger WHERE tgname = 'set_agenda_items_updated_at'
     ) THEN
    CREATE TRIGGER set_agenda_items_updated_at
      BEFORE UPDATE ON public.agenda_items
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

COMMIT;

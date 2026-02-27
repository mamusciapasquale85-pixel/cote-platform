-- Normalize public.agenda_items.slot as text labels P1..P10 for PROF schedule imports.
-- Idempotent and safe with existing integer/text slots.

DO $$
DECLARE
  slot_type text;
BEGIN
  SELECT c.data_type
    INTO slot_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'agenda_items'
    AND c.column_name = 'slot';

  IF slot_type IS NULL THEN
    ALTER TABLE public.agenda_items
      ADD COLUMN slot text;
    slot_type := 'text';
  END IF;

  IF slot_type IN ('smallint', 'integer', 'bigint', 'numeric') THEN
    ALTER TABLE public.agenda_items
      ALTER COLUMN slot TYPE text
      USING CASE
        WHEN slot IS NULL THEN NULL
        ELSE 'P' || slot::text
      END;
  END IF;
END $$;

-- Normalize text values if needed.
UPDATE public.agenda_items
SET slot = UPPER(BTRIM(slot))
WHERE slot IS NOT NULL;

UPDATE public.agenda_items
SET slot = 'P' || slot
WHERE slot ~ '^(10|[1-9])$';

ALTER TABLE public.agenda_items
  DROP CONSTRAINT IF EXISTS agenda_items_slot_check;

ALTER TABLE public.agenda_items
  ADD CONSTRAINT agenda_items_slot_check
  CHECK (slot IS NULL OR slot IN ('P1','P2','P3','P4','P5','P6','P7','P8','P9','P10'));

CREATE INDEX IF NOT EXISTS agenda_items_school_year_teacher_date_slot_idx
  ON public.agenda_items (school_id, academic_year_id, teacher_id, date, slot);

CREATE INDEX IF NOT EXISTS agenda_items_class_date_slot_idx
  ON public.agenda_items (class_group_id, date, slot);

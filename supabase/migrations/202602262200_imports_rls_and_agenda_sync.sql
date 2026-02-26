BEGIN;

-- ---------------------------------------------------------------------------
-- A) Agenda schema sync (slot + assessment_id) for CSV import and weekly grid
-- ---------------------------------------------------------------------------
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
    ALTER TABLE public.agenda_items
      ADD COLUMN slot integer;
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
  ADD COLUMN IF NOT EXISTS assessment_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_items_assessment_id_fkey'
  ) THEN
    ALTER TABLE public.agenda_items
      ADD CONSTRAINT agenda_items_assessment_id_fkey
      FOREIGN KEY (assessment_id)
      REFERENCES public.assessments(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS agenda_items_school_year_date_slot_idx
  ON public.agenda_items (school_id, academic_year_id, date, slot);

CREATE INDEX IF NOT EXISTS agenda_items_teacher_date_slot_idx
  ON public.agenda_items (teacher_id, date, slot);

CREATE INDEX IF NOT EXISTS agenda_items_class_date_slot_idx
  ON public.agenda_items (class_group_id, date, slot);

CREATE INDEX IF NOT EXISTS agenda_items_assessment_id_idx
  ON public.agenda_items (assessment_id);

-- Optional metadata columns for future CSV mapping/display.
ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS course_name text NULL;

ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS tag text NULL;

DO $$
BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_trigger
       WHERE tgname = 'set_agenda_items_updated_at'
     ) THEN
    CREATE TRIGGER set_agenda_items_updated_at
      BEFORE UPDATE ON public.agenda_items
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- B) RLS policies for students/student_enrollments/class_groups (teacher scope)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  has_role boolean;
  has_status boolean;
  membership_expr text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_memberships'
      AND column_name = 'role'
  )
  INTO has_role;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_memberships'
      AND column_name = 'status'
  )
  INTO has_status;

  membership_expr := 'EXISTS (SELECT 1 FROM public.school_memberships sm WHERE sm.user_id = auth.uid() AND sm.school_id = school_id';
  IF has_role THEN
    membership_expr := membership_expr || ' AND sm.role IN (''teacher'',''admin'')';
  END IF;
  IF has_status THEN
    membership_expr := membership_expr || ' AND sm.status = ''active''';
  END IF;
  membership_expr := membership_expr || ')';

  IF to_regclass('public.students') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.students ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS students_teacher_select ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_teacher_insert ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_teacher_update ON public.students';
    EXECUTE format('CREATE POLICY students_teacher_select ON public.students FOR SELECT USING (%s)', membership_expr);
    EXECUTE format('CREATE POLICY students_teacher_insert ON public.students FOR INSERT WITH CHECK (%s)', membership_expr);
    EXECUTE format('CREATE POLICY students_teacher_update ON public.students FOR UPDATE USING (%s) WITH CHECK (%s)', membership_expr, membership_expr);
  END IF;

  IF to_regclass('public.student_enrollments') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS student_enrollments_teacher_select ON public.student_enrollments';
    EXECUTE 'DROP POLICY IF EXISTS student_enrollments_teacher_insert ON public.student_enrollments';
    EXECUTE 'DROP POLICY IF EXISTS student_enrollments_teacher_update ON public.student_enrollments';
    EXECUTE 'DROP POLICY IF EXISTS student_enrollments_teacher_delete ON public.student_enrollments';
    EXECUTE format('CREATE POLICY student_enrollments_teacher_select ON public.student_enrollments FOR SELECT USING (%s)', membership_expr);
    EXECUTE format('CREATE POLICY student_enrollments_teacher_insert ON public.student_enrollments FOR INSERT WITH CHECK (%s)', membership_expr);
    EXECUTE format('CREATE POLICY student_enrollments_teacher_update ON public.student_enrollments FOR UPDATE USING (%s) WITH CHECK (%s)', membership_expr, membership_expr);
    EXECUTE format('CREATE POLICY student_enrollments_teacher_delete ON public.student_enrollments FOR DELETE USING (%s)', membership_expr);
  END IF;

  IF to_regclass('public.class_groups') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS class_groups_teacher_select ON public.class_groups';
    EXECUTE 'DROP POLICY IF EXISTS class_groups_teacher_insert ON public.class_groups';
    EXECUTE 'DROP POLICY IF EXISTS class_groups_teacher_update ON public.class_groups';
    EXECUTE 'DROP POLICY IF EXISTS class_groups_teacher_delete ON public.class_groups';
    EXECUTE format('CREATE POLICY class_groups_teacher_select ON public.class_groups FOR SELECT USING (%s)', membership_expr);
    EXECUTE format('CREATE POLICY class_groups_teacher_insert ON public.class_groups FOR INSERT WITH CHECK (%s)', membership_expr);
    EXECUTE format('CREATE POLICY class_groups_teacher_update ON public.class_groups FOR UPDATE USING (%s) WITH CHECK (%s)', membership_expr, membership_expr);
    EXECUTE format('CREATE POLICY class_groups_teacher_delete ON public.class_groups FOR DELETE USING (%s)', membership_expr);
  END IF;
END
$$;

COMMIT;

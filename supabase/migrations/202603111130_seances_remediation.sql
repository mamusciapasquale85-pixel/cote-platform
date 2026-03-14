BEGIN;

CREATE TABLE IF NOT EXISTS public.seances_remediation (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  remediation_id uuid REFERENCES public.remediations(id) ON DELETE CASCADE,
  date_seance timestamptz NOT NULL,
  duree_minutes integer DEFAULT 30,
  statut text DEFAULT 'Planifiee' CHECK (statut IN ('Planifiee', 'Realisee', 'Annulee')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seance_eleves (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  seance_id uuid REFERENCES public.seances_remediation(id) ON DELETE CASCADE,
  eleve_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  UNIQUE(seance_id, eleve_id)
);

CREATE INDEX IF NOT EXISTS seances_remediation_date_idx
  ON public.seances_remediation (date_seance);

CREATE INDEX IF NOT EXISTS seances_remediation_remediation_idx
  ON public.seances_remediation (remediation_id);

CREATE INDEX IF NOT EXISTS seance_eleves_seance_idx
  ON public.seance_eleves (seance_id);

CREATE INDEX IF NOT EXISTS seance_eleves_eleve_idx
  ON public.seance_eleves (eleve_id);

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS public.remediations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  eleve_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  classe_id uuid REFERENCES public.class_groups(id) ON DELETE SET NULL,
  apprentissage_id uuid REFERENCES public.apprentissages(id) ON DELETE SET NULL,
  attendu text,
  type_remediation text DEFAULT 'Exercices',
  origine text DEFAULT 'Automatique',
  statut text DEFAULT 'Proposée',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.remediations
  DROP CONSTRAINT IF EXISTS remediations_statut_check;

ALTER TABLE public.remediations
  ADD CONSTRAINT remediations_statut_check
  CHECK (statut IN ('Proposée', 'En cours', 'Terminée'));

CREATE INDEX IF NOT EXISTS remediations_eleve_id_idx
  ON public.remediations (eleve_id);

CREATE INDEX IF NOT EXISTS remediations_classe_id_idx
  ON public.remediations (classe_id);

CREATE INDEX IF NOT EXISTS remediations_apprentissage_id_idx
  ON public.remediations (apprentissage_id);

CREATE INDEX IF NOT EXISTS remediations_created_at_idx
  ON public.remediations (created_at DESC);

COMMIT;

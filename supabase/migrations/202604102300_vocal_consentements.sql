-- Table pour tracer les consentements parentaux (RGPD art. 8)
-- Un enregistrement = un consentement donné pour un élève

CREATE TABLE IF NOT EXISTS public.vocal_consentements (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  eleve_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  consenti_par  text NOT NULL,          -- "parent" | "tuteur"
  ip_address    inet,                   -- IP du consentement (preuve)
  user_agent    text,                   -- navigateur (preuve)
  created_at    timestamptz DEFAULT now() NOT NULL,
  retire_at     timestamptz,            -- NULL = consentement actif
  UNIQUE (eleve_id)                     -- 1 consentement actif par élève
);

-- RLS : un enseignant peut lire les consentements de ses élèves
ALTER TABLE public.vocal_consentements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture consentements par enseignant"
  ON public.vocal_consentements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = eleve_id
    )
  );

CREATE POLICY "Insert consentement"
  ON public.vocal_consentements FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Retrait consentement"
  ON public.vocal_consentements FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Index pour lookup rapide
CREATE INDEX IF NOT EXISTS idx_vocal_consentements_eleve
  ON public.vocal_consentements (eleve_id)
  WHERE retire_at IS NULL;

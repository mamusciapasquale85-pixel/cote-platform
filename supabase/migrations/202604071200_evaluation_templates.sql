-- ── Banque de modèles d'évaluation ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluation_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id       UUID,
  titre           TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'formative',
  matiere         TEXT NOT NULL DEFAULT 'nl',
  competence      TEXT,
  niveau          TEXT DEFAULT 'A1',
  type_exercice   TEXT DEFAULT 'flashcards',
  points_max      INTEGER DEFAULT 20,
  cotation_type   TEXT DEFAULT 'points',
  fichier_path    TEXT,
  fichier_nom     TEXT,
  grille          JSONB,
  instructions    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE evaluation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own templates"
  ON evaluation_templates FOR ALL
  USING (auth.uid() = user_id);

-- Colonne template_id sur assessments (traçabilité)
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES evaluation_templates(id);

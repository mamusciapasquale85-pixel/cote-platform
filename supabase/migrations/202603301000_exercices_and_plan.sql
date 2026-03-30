-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : table exercices + colonne plan sur user_profiles
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Table exercices
CREATE TABLE IF NOT EXISTS exercices (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject        text        NOT NULL DEFAULT '',
  type_exercice  text        NOT NULL DEFAULT '',
  niveau         text        NOT NULL DEFAULT '',
  theme          text        NOT NULL DEFAULT '',
  titre          text        NOT NULL DEFAULT '',
  contenu        text        NOT NULL DEFAULT '',
  classe         text        NOT NULL DEFAULT '',
  created_at     timestamptz DEFAULT now() NOT NULL
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS exercices_teacher_id_idx ON exercices (teacher_id);
CREATE INDEX IF NOT EXISTS exercices_created_at_idx ON exercices (created_at DESC);

-- RLS
ALTER TABLE exercices ENABLE ROW LEVEL SECURITY;

-- Propriétaire : accès total
CREATE POLICY "exercices_owner_select" ON exercices
  FOR SELECT USING (auth.uid() = teacher_id);

CREATE POLICY "exercices_owner_insert" ON exercices
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "exercices_owner_delete" ON exercices
  FOR DELETE USING (auth.uid() = teacher_id);

-- Lecture publique par id (lien élève — UUID est non-devinable)
CREATE POLICY "exercices_public_read" ON exercices
  FOR SELECT USING (true);

-- 2. Colonne plan sur user_profiles (gratuit / pro / ecole)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS plan           text        NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- 3. Table usage_mensuel pour le comptage freemium
CREATE TABLE IF NOT EXISTS usage_mensuel (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mois        text        NOT NULL, -- format 'YYYY-MM'
  nb_exercices int        NOT NULL DEFAULT 0,
  UNIQUE (user_id, mois)
);

ALTER TABLE usage_mensuel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_owner_all" ON usage_mensuel
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Index de recherche full-text sur les exercices (optionnel, pour la page historique)
CREATE INDEX IF NOT EXISTS exercices_titre_search_idx ON exercices USING gin(to_tsvector('french', titre || ' ' || theme));

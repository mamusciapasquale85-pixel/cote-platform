-- Ajouter les colonnes subject, niveau et exercice_propose à la table remediations
-- subject : identifiant matière ('nl', 'en', 'mathematiques', etc.)
-- niveau  : niveau de l'élève ('A1', 'A2', '1S', '2S', etc.)
-- exercice_propose : exercice auto-généré par l'IA au moment de la création
--   JSONB format : { titre, contenu, subject, type_exercice, niveau }

ALTER TABLE public.remediations
  ADD COLUMN IF NOT EXISTS subject        TEXT,
  ADD COLUMN IF NOT EXISTS niveau         TEXT,
  ADD COLUMN IF NOT EXISTS exercice_propose JSONB;

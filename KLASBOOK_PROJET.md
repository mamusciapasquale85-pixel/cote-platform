# Klasbook — Fichier Projet Claude
> À copier dans `/Users/pasquale/Claude/projets/klasbook.md`
> Dernière mise à jour : mars 2026

---

## IDENTITÉ DU PROJET

**Nom :** Klasbook
**Type :** SaaS pédagogique (B2B/B2C — écoles et profs FWB)
**Stack :** Next.js 16.1.6 + TypeScript strict + React 19 + Supabase (PostgreSQL) + Anthropic Claude Sonnet 4.6
**Repo local :** `/Users/pasquale/cote-platform/` (ou dossier de travail Cowork)
**Supabase project ID :** `wvgluiycajijcpfifrjv`
**Dev :** Pasquale (solo), prof de néerlandais au LAB Marie Curie, Bruxelles

---

## ÉTAT ACTUEL DES FONCTIONNALITÉS

### ✅ Fonctionnalités terminées

#### 1. Génération d'exercices IA — multi-matières
- **Route :** `/src/app/api/generer-exercice/route.ts`
- **Matières supportées :** Néerlandais (NL), Anglais (EN), Mathématiques, Sciences, Histoire, Géographie, Français
- **Types d'exercices :** ~25 types selon la matière (lacunes, QCM, dialogue, conjugaison, problème, géométrie, analyse de source, croquis, expression écrite, etc.)
- **Niveaux :** 1S, 2S, 3S (et CECRL : A1, A2, B1, B2)
- **Référentiels FWB intégrés :** chaque génération injecte le référentiel officiel IFPC pour la matière + niveau concernés → conformité garantie
- **Contexte FWB dans le system prompt** : `CONTEXTE_SYSTEME_FWB` injecté à chaque appel Anthropic

#### 2. Référentiels FWB officiels
- **Fichier :** `/src/lib/referentiels-fwb.ts`
- **Source :** IFPC-FWB (Pacte pour un Enseignement d'Excellence), extraits des PDF officiels via pdfplumber
- **Matières couvertes :** Langues Modernes (NL/EN), Français, Mathématiques, Sciences, Histoire, Géographie
- **Exports :** `REFERENTIELS_PAR_MATIERE`, `getReferentiel(subject, niveau)`, `CONTEXTE_SYSTEME_FWB`, constantes individuelles par matière
- **Niveaux détaillés :** 1S et 2S pour toutes les matières (savoirs, attendus, compétences)

#### 3. Inspecteur FWB (chatbot pédagogique)
- **Route :** `/src/app/api/inspecteur-fwb/route.ts`
- **Couverture :** TOUTES les matières du Tronc Commun (Langues, Maths, Sciences, Histoire, Géo, Français)
- **7 compétences :** Chat libre, Analyse de copie, Grille d'évaluation, Différenciation 3 niveaux, Planification annuelle, Conformité FWB, Intégration Tandem Brio
- **Détection automatique de la matière** depuis les messages utilisateur (regex sur mots-clés)
- **Tous les référentiels officiels intégrés** dans le system prompt

#### 4. Créer une évaluation avec canevas école
- **Page :** `/src/app/creer-evaluation/page.tsx`
- **Layout :** `/src/app/creer-evaluation/layout.tsx` (utilise `ProfShell`)
- **Fonctionnalités :**
  - Formulaire canevas école : nom de l'école, adresse, nom du prof → sauvegardé dans `user_profiles.template_json` (Supabase)
  - Sélecteur de matière (7 matières), niveau, type d'exercice, thème
  - Appel à `/api/generer-exercice` → prévisualisation live
  - Téléchargement PDF via jspdf : en-tête colorée (dark #0f172a + accent #0A84FF), grille d'infos, contenu paginé
- **Migration Supabase appliquée :** `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS template_json jsonb DEFAULT '{}'::jsonb NOT NULL`

#### 5. Navigation
- **Fichier :** `/src/app/prof/ProfShell.tsx`
- Item "📄 Créer une éval." ajouté entre Évaluations et Remédiations

---

## ARCHITECTURE TECHNIQUE

```
/src
├── app/
│   ├── api/
│   │   ├── generer-exercice/route.ts   ← IA multi-matières + référentiels FWB
│   │   ├── inspecteur-fwb/route.ts     ← Chatbot pédagogique toutes matières
│   │   └── remediations/[id]/route.ts  ← Bug Next.js 15 async params (pré-existant)
│   ├── creer-evaluation/
│   │   ├── page.tsx                    ← UI génération + PDF
│   │   └── layout.tsx
│   └── prof/
│       └── ProfShell.tsx               ← Navigation sidebar
└── lib/
    ├── referentiels-fwb.ts             ← Tous les référentiels IFPC officiels
    └── supabase/
        └── server.ts
```

---

## BASE DE DONNÉES SUPABASE

**Projet :** `wvgluiycajijcpfifrjv`

### Table `user_profiles`
| Colonne | Type | Notes |
|---------|------|-------|
| id | uuid | FK → auth.users |
| ... | ... | colonnes existantes |
| template_json | jsonb | Canevas école (school_name, teacher_name, address) — DEFAULT '{}' |

---

## DESIGN SYSTEM

- **Gradient principal :** `linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)`
- **Sidebar :** `#0f172a`
- **Accent :** `#0A84FF`
- **PDF header bg :** `#0f172a` avec barre accent `#0A84FF`
- **Labels FWB / UI :** toujours en français

---

## MODÈLE IA

- **Modèle Anthropic :** `claude-sonnet-4-6`
- **Variable d'env :** `ANTHROPIC_API_KEY` (dans `.env.local`)
- **max_tokens :** 4000 (exercices) / 4096 (inspecteur)
- **PDF client-side :** `jspdf v4.2.0` (déjà dans package.json)

---

## DÉCISIONS TECHNIQUES IMPORTANTES

1. **Architecture unifiée** : 1 seule appli pour toutes les matières (vs 3 applis séparées) → routing par `subject` dans les prompts
2. **PDF client-side** : jspdf (déjà installé) plutôt que serveur → évite les problèmes SSR
3. **Template persistence** : colonne `template_json` JSONB dans `user_profiles` existante (pas de nouvelle table)
4. **Référentiels en TypeScript** : constants exportées depuis `referentiels-fwb.ts` → tree-shakable, typé, pas de fetch à runtime
5. **Conformité FWB** : injection automatique du référentiel dans CHAQUE prompt de génération (garantie qualité inspection)

---

## RÈGLES DE DÉVELOPPEMENT

- Fichiers complets uniquement (pas d'extraits partiels)
- TypeScript strict — zéro erreur dans les nouveaux fichiers
- Labels et statuts en français dans l'UI
- Pas de nouvelle table Supabase si une colonne JSONB dans l'existante suffit
- Le bug Next.js 15 async params dans `remediations/[id]/route.ts` est pré-existant — ne pas toucher

---

## PROCHAINES ÉTAPES POTENTIELLES

- [ ] Page élève : interface pour passer les exercices générés
- [ ] Sauvegarde des exercices générés en base (table `exercices` ?)
- [ ] Historique des évaluations par classe
- [ ] Export vers Google Classroom / Teams
- [ ] Commercialisation : pricing par école / abonnement mensuel
- [ ] Page de landing + onboarding pour nouveaux profs
- [ ] Correction automatique des copies élèves (route IA dédiée)

---

## JOURNAL — Sessions importantes

### Mars 2026 — Session "Multi-matières + Référentiels FWB"
**Décisions :**
- Extension Klasbook de NL uniquement → 7 matières (NL, EN, Maths, Sciences, Histoire, Géo, Français)
- Création du module `referentiels-fwb.ts` avec tous les référentiels IFPC officiels extraits des PDF
- Nouvelle page `/creer-evaluation` avec canevas école personnalisable + export PDF
- Mise à jour `ProfShell` (nav item "Créer une éval.")
- Migration Supabase : ajout `template_json` dans `user_profiles`
- `generer-exercice/route.ts` : intégration automatique des référentiels FWB dans chaque prompt
- `inspecteur-fwb/route.ts` : étendu à toutes les matières, détection automatique de la matière

# Klasbook — Fichier Projet Claude
> Chemin : `/Users/pasquale/klasbook-dev/KLASBOOK_PROJET.md`
> Dernière mise à jour : avril 2026

---

## IDENTITÉ DU PROJET

**Nom :** Klasbook
**Type :** SaaS pédagogique (B2C profs individuels + B2B écoles FWB)
**Stack :** Next.js 16.1.6 + TypeScript strict + React 19 + Tailwind 4 + Supabase (PostgreSQL) + Anthropic Claude Sonnet 4.6
**Repo local :** `/Users/pasquale/klasbook-dev/`
**Copie secondaire :** `/Users/pasquale/cote-platform/`
**Supabase project ID :** `wvgluiycajijcpfifrjv`
**Domaine :** `klasbook.be` (Vercel) · Landing page sur Netlify (`klasbook-site/`)
**Dev :** Pasquale De Michele (solo), prof de néerlandais au LAB Marie Curie, Bruxelles

---

## STACK TECHNIQUE COMPLET

| Couche | Technologie | Version / Config |
|--------|------------|-----------------|
| Framework | Next.js | 16.1.6 (App Router) |
| Frontend | React + Tailwind CSS | 19.2.3 / 4 |
| Langage | TypeScript strict | 5.x |
| Base de données | Supabase (PostgreSQL) | EU (Francfort) |
| Auth | Supabase Auth (SSR) | `@supabase/ssr` 0.8 |
| IA génération | Anthropic Claude Sonnet 4.6 | `@anthropic-ai/sdk` 0.88 |
| IA vocale | Azure Speech Services | Prononciation + TTS |
| Paiement | Stripe | 21.x (API `2026-03-25.dahlia`) |
| PDF | jspdf 4.2 + pdf-lib 1.17 | Client-side |
| Emails | Resend | 6.9 (noreply@klasbook.be) |
| Automatisation | n8n Cloud | `mamusciapasquale5885.app.n8n.cloud` |
| Data sync | Airtable | Base `apptufHooDgBKNsNt` |
| Déploiement | Vercel (app) + Netlify (landing) | |

---

## ARCHITECTURE COMPLÈTE

```
/src
├── app/
│   ├── api/
│   │   ├── billing/
│   │   │   ├── checkout/route.ts        ← Stripe Checkout (pro/école, mensuel/annuel)
│   │   │   ├── portal/route.ts          ← Stripe Customer Portal
│   │   │   ├── usage/route.ts           ← Compteur usage mensuel
│   │   │   └── webhook/route.ts         ← Webhook Stripe (checkout.completed, subscription.updated/deleted)
│   │   ├── generer-exercice/route.ts    ← IA multi-matières + référentiels FWB + quota freemium
│   │   ├── inspecteur-fwb/route.ts      ← Chatbot pédagogique toutes matières
│   │   ├── corriger-copie/route.ts      ← Correction IA (texte)
│   │   ├── corriger-copies-scannees/route.ts ← Correction IA (scan, multi-copies, + remédiation auto)
│   │   ├── generer-appreciation/route.ts ← Appréciations bulletins IA
│   │   ├── vocal-session/route.ts       ← Exercices vocaux Azure Speech (NL, EN, ES)
│   │   ├── evaluation-templates/
│   │   │   ├── route.ts                 ← CRUD templates évaluations
│   │   │   └── [id]/
│   │   │       ├── route.ts             ← GET/PUT/DELETE template
│   │   │       └── distribute/route.ts  ← Distribution éval aux élèves
│   │   ├── evaluations/
│   │   │   ├── correct/route.ts         ← Correction évaluations
│   │   │   ├── grid/route.ts            ← Grille d'évaluation
│   │   │   └── upload/route.ts          ← Upload copies
│   │   ├── remediations/
│   │   │   ├── route.ts                 ← Liste remédiations
│   │   │   ├── [id]/route.ts            ← Détail remédiation
│   │   │   └── generer/route.ts         ← Génération remédiation IA
│   │   ├── seances-remediation/
│   │   │   ├── route.ts                 ← CRUD séances
│   │   │   └── [id]/route.ts            ← Détail séance
│   │   ├── import/
│   │   │   ├── analyser/route.ts        ← Analyse IA du fichier importé
│   │   │   └── confirmer/route.ts       ← Confirmation + conversion vers TB/B/S/I/NI
│   │   ├── pdf/bulletin/route.ts        ← Génération PDF bulletin
│   │   ├── inviter-parent/route.ts      ← Invitation parent par email (Resend)
│   │   ├── notify-parent/route.ts       ← Notification parent
│   │   ├── dashboard/route.ts           ← Données tableau de bord
│   │   ├── eleves/[id]/dashboard/route.ts ← Dashboard individuel élève
│   │   ├── classe/route.ts              ← Gestion classes
│   │   ├── profil/
│   │   │   ├── cours/route.ts           ← Cours du prof
│   │   │   └── matiere/route.ts         ← Matière du prof
│   │   ├── planification/
│   │   │   ├── data/route.ts            ← Données planification
│   │   │   └── sources/route.ts         ← Sources Notion
│   │   ├── notion/
│   │   │   ├── sync/route.ts            ← Sync Notion
│   │   │   ├── download/route.ts        ← Download depuis Notion
│   │   │   └── planification/route.ts   ← Planification via Notion
│   │   ├── admin/sync-airtable/route.ts ← Sync Airtable
│   │   ├── register/route.ts            ← Inscription
│   │   ├── demo/route.ts                ← Mode démo
│   │   ├── init-demo/route.ts           ← Initialisation démo
│   │   └── fix-demo-auth/route.ts       ← Fix auth démo
│   │
│   ├── dashboard/                        ← 🏠 Accueil / Tableau de bord
│   ├── classe/                           ← 👥 Gestion des classes
│   ├── agenda/                           ← 📅 Agenda & planification (slots, notes)
│   ├── evaluations/                      ← 📝 Évaluations (+ corriger/)
│   ├── resultats/                        ← 📊 Résultats par compétence
│   ├── remediations/                     ← 🩺 Remédiations
│   ├── seances-remediation/              ← 🩺 Séances de remédiation
│   ├── bulletins/                        ← 📄 Bulletins FWB
│   ├── competences/                      ← 🎯 Suivi des apprentissages
│   ├── vocal/                            ← 🎙️ Exercices vocaux (+ admin/)
│   ├── generateur/                       ← ✨ Générateur d'exercices IA
│   ├── creer-evaluation/                 ← 📄 Créer une évaluation PDF
│   ├── historique/                       ← 📚 Historique des exercices
│   ├── outils/                           ← 🎲 Outils complémentaires
│   ├── import/                           ← 📥 Import intelligent
│   ├── planification/                    ← 📅 Planification pédagogique
│   ├── absences/                         ← Gestion des absences
│   ├── discipline/                       ← Remarques / discipline
│   ├── eleves/[id]/                      ← Fiche élève détaillée
│   ├── eleve/[id]/                       ← Dashboard élève individuel
│   ├── apprentissages/                   ← Grille d'apprentissages
│   │
│   ├── parent/                           ← 👨‍👩‍👧 Portail parents
│   ├── direction/                        ← 🏫 Portail direction
│   │
│   ├── pricing/                          ← Page tarifs (in-app)
│   ├── onboarding/                       ← Onboarding nouveau prof
│   ├── login/                            ← Connexion
│   ├── accept-invitation/                ← Acceptation invitation parent
│   ├── reset-password/                   ← Réinitialisation mot de passe
│   ├── cgu/                              ← Conditions générales
│   ├── vie-privee/                       ← Politique de confidentialité
│   ├── auth/callback/ + logout/          ← Auth flows Supabase
│   │
│   ├── prof/
│   │   ├── ProfShell.tsx                 ← Navigation principale (sidebar desktop + bottom bar mobile)
│   │   └── ProfTabs.tsx                  ← Tabs secondaires
│   ├── components/TeacherTabs.tsx        ← Tabs enseignant
│   └── globals.css                       ← Design system (variables CSS)
│
├── components/
│   ├── eleve/EleveDashboardDrawer.tsx    ← Drawer dashboard élève
│   ├── remediation/
│   │   ├── GenererExerciceModal.tsx      ← Modal génération exercice remédiation
│   │   └── PlanifierSeanceModal.tsx      ← Modal planification séance
│   ├── remediations/GenerateurRemediation.tsx ← Générateur remédiation
│   └── vocal/
│       ├── ConsentementParentalModal.tsx ← Consentement parental RGPD
│       ├── PronunciationFeedback.tsx     ← Feedback prononciation
│       ├── VocalPlayer.tsx              ← Lecteur audio
│       └── VocalRecorder.tsx            ← Enregistreur vocal
│
├── lib/
│   ├── billing.ts                       ← Logique freemium (quotas, plans, usage)
│   ├── referentiels-fwb.ts              ← Référentiels IFPC officiels (7 matières, 1S-3S)
│   ├── generateExercicePropose.ts       ← Génération exercice remédiation (Claude Haiku)
│   ├── remediations-handler.ts          ← Handler remédiations
│   ├── azure-speech.ts                  ← Azure Speech SDK (TTS + prononciation)
│   ├── azure-speech-cache.ts            ← Cache audio Azure
│   ├── date.ts                          ← Utilitaires dates
│   ├── emails/index.ts                  ← Templates emails Resend
│   └── supabase/
│       ├── client.ts                    ← Client Supabase (browser)
│       ├── server.ts                    ← Client Supabase (server)
│       └── middleware.ts                ← Middleware auth Supabase
│
├── middleware.ts                         ← Middleware Next.js (protection routes)
└── klasbook-site/index.html             ← Landing page statique (Netlify)
```

---

## FONCTIONNALITÉS — ÉTAT COMPLET

### ✅ Terminées et fonctionnelles

#### Génération IA
- **Générateur d'exercices multi-matières** — 25+ types, 7 matières (NL, EN, FR, Maths, Sciences, Histoire, Géo), niveaux 1S-6S + CECRL A1-B2, référentiels IFPC injectés automatiquement
- **Inspecteur FWB** — Chatbot IA toutes matières (7 compétences : chat libre, analyse copie, grille éval, différenciation 3 niveaux, planification, conformité FWB, Tandem Brio)
- **Correction IA de copies** — Texte ET scan (multi-copies), avec feedback personnalisé + déclenchement remédiation auto
- **Appréciations bulletins IA** — Génération d'appréciations personnalisées par élève
- **Remédiation automatique** — Exercice ciblé généré par IA sur la lacune précise (échelle TB/B/S/I/NI, I et NI déclenchent la remédiation)
- **Exercices vocaux** — Azure Speech : TTS (nl-BE, en-GB, es-ES) + évaluation prononciation + feedback IA

#### Gestion pédagogique
- **Classes & élèves** — CRUD complet, import CSV, 121 élèves réels
- **Évaluations** — Formatives + sommatives, grille de compétences, distribution aux élèves
- **Résultats** — Saisie par compétence, échelle TB/B/S/I/NI
- **Bulletins** — Conformes FWB, appréciations IA, export PDF
- **Compétences / Apprentissages** — Grille par élève et par classe, label personnalisable
- **Séances de remédiation** — Planification, suivi, historique
- **Import intelligent** — Analyse IA du format (Excel, CSV, Smartschool) → conversion automatique vers TB/B/S/I/NI
- **Créateur d'évaluations PDF** — Canevas école personnalisable (nom, adresse, prof), export PDF via jspdf

#### Organisation
- **Agenda** — Slots, notes de cours, planification hebdomadaire
- **Absences** — Gestion des absences
- **Discipline** — Remarques disciplinaires
- **Planification** — Sync Notion, données planification
- **Historique** — Historique des exercices générés
- **Outils** — Outils complémentaires divers

#### Portails
- **Portail parents** — Suivi progression enfant, invitation par email (Resend), notifications
- **Portail direction** — Vue établissement (plan École)

#### Billing & Auth
- **Stripe complet** — Checkout, Customer Portal, webhooks (checkout.completed, subscription.updated, subscription.deleted)
- **Freemium** — Plan gratuit (10 exercices/mois, 1 classe) avec compteur `usage_mensuel`
- **Plans** — Gratuit / Pro (19€/mois, 149€/an) / École (149€/mois, 1190€/an)
- **Auth Supabase SSR** — Login, register, reset password, logout, middleware protection
- **Onboarding** — Flow nouvel utilisateur
- **CGU + Vie privée** — Pages légales complètes

#### Emails
- **Resend** — Invitations parents, notifications, templates HTML branded

---

## BASE DE DONNÉES SUPABASE

**Projet :** `wvgluiycajijcpfifrjv` (EU — Francfort)

### Migrations appliquées (chronologique)
1. `202602241630` — `apprentissages` + `assessments.apprentissage_id`
2. `202602262010` — `attendance_records` (absences)
3. `202602262200` — `imports` RLS + `agenda` sync
4. `202602271930` — `agenda_items.slot_text`
5. `202602272220` — Agenda cockpit (weekly slots + notes)
6. `202602272230` — `lesson_notes`
7. `202602272320` — `discipline_notes`
8. `202603020900` — `remarques`
9. `202603031100` — `agenda_items.slot_int` + `lesson_tag`
10. `202603031120` — `discipline_notes` (class + teacher)
11. `202603102030` — `remediations`
12. `202603111130` — `seances_remediation`
13. `202603301000` — `exercices` + `plan` (user_profiles)
14. `202604071200` — `evaluation_templates`
15. `202604102200` — `remediations.exercice_propose`
16. `202604102300` — `vocal_consentements`

### Tables principales
| Table | Usage |
|-------|-------|
| `user_profiles` | Profils profs (plan, stripe_customer_id, plan_expires_at, template_json) |
| `school_memberships` | Appartenance école + matière |
| `courses` | Cours par prof |
| `classes` | Classes |
| `students` | Élèves (121 réels) |
| `assessments` | Évaluations |
| `assessment_results` | Résultats par compétence (TB/B/S/I/NI) |
| `remediations` | Remédiations (+ exercice_propose JSONB) |
| `seances_remediation` | Séances de remédiation |
| `evaluation_templates` | Templates d'évaluations |
| `exercices` | Exercices générés sauvegardés |
| `usage_mensuel` | Compteur exercices/mois (freemium) |
| `apprentissages` | Grille d'apprentissages |
| `agenda_items` | Items agenda (slots, notes) |
| `lesson_notes` | Notes de cours |
| `attendance_records` | Absences |
| `discipline_notes` | Remarques discipline |
| `remarques` | Remarques générales |
| `vocal_consentements` | Consentements parentaux (RGPD vocal) |
| `imports` | Historique imports |

---

## DESIGN SYSTEM

### Couleurs app (globals.css)
| Variable | Valeur | Usage |
|----------|--------|-------|
| `--background` | `#f6f8ff` | Fond page |
| `--surface` | `#ffffff` | Cards, surfaces |
| `--text` | `#0f172a` | Texte principal |
| `--primary` | `#4f7cff` | Bleu principal |
| `--secondary` | `#9b7bff` | Violet secondaire |
| `--accent1` | `#ff5a7a` | Rose accent |
| `--accent2` | `#22c55e` | Vert succès |
| `--warning` | `#f59e0b` | Orange alerte |
| `--border` | `rgba(15,23,42,0.08)` | Bordures |

### Gradient logo
`linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)` avec icône ✦

### Coins arrondis
- Cards : 20px (`--radius-card`)
- Pills : 999px (`--radius-pill`)
- Inputs : 14px
- Boutons : 14px

### Font
DM Sans (Google Fonts) — weights 400-900

### Ombres
- `--shadow-soft` : `0 12px 30px rgba(15,23,42,0.1)`
- `--shadow-card` : `0 8px 20px rgba(15,23,42,0.08)`

---

## NAVIGATION (ProfShell.tsx)

12 items principaux :
1. 🏠 Accueil → `/dashboard`
2. 👥 Classes → `/classe`
3. 📅 Agenda → `/agenda`
4. 📝 Évaluations → `/evaluations`
5. 📊 Résultats → `/resultats`
6. 🩺 Remédiations → `/remediations`
7. 📄 Bulletins → `/bulletins`
8. 🎯 Apprentissages → `/competences`
9. 🎙️ Outil vocal → `/vocal`
10. ✨ Générateur IA → `/generateur`
11. 📚 Historique → `/historique`
12. 🎲 Outils → `/outils`

Mobile : bottom bar avec 5 épinglés (Accueil, Évaluations, Résultats, Bulletins, Vocal) + drawer "Plus"

---

## MODÈLE IA

| Modèle | Usage | max_tokens |
|--------|-------|------------|
| Claude Sonnet 4.6 | Exercices, inspecteur, corrections | 4000-4096 |
| Claude Haiku | Remédiation auto (fire & forget) | 2000 |
| Azure Speech (nl-BE, en-GB, es-ES) | TTS + évaluation prononciation | — |

---

## BILLING / MONÉTISATION

### Plans
| Plan | Prix mensuel | Prix annuel | Limites |
|------|-------------|-------------|---------|
| Starter (gratuit) | 0€ | 0€ | 10 exercices/mois, 1 classe, pas de correction/bulletins/vocal/parents |
| Pro | 19€ | 149€ | Illimité, toutes features |
| École | 149€ | 1 190€ | Jusqu'à 20 profs, portail direction, DPA, onboarding |

### Stripe
- Checkout : `/api/billing/checkout` (Price IDs via env vars)
- Portal : `/api/billing/portal`
- Webhook : `/api/billing/webhook` (3 events : checkout.completed, subscription.updated, subscription.deleted)
- API version : `2026-03-25.dahlia`

### Quota freemium (lib/billing.ts)
- `getUserPlan()` — retourne le plan actif (vérifie expiration)
- `checkAndIncrementExerciceUsage()` — vérifie + incrémente le compteur mensuel
- `getExerciceUsageSummary()` — pour affichage UI
- Table `usage_mensuel` : `user_id` + `mois` (format "2026-04") + `nb_exercices`

---

## EMAILS (Resend)

- **Expéditeur :** `noreply@klasbook.be`
- **Templates :** Invitation parent, notification parent, emails transactionnels
- **Plan :** Gratuit Resend (3 000 emails/mois)

---

## AUTOMATISATION (n8n)

- **Instance :** `mamusciapasquale5885.app.n8n.cloud`
- **Workflows :**
  - "Rapport hebdomadaire" (ID: `yzjGgR887aSuW2WU`)
  - "Alerte élève en difficulté" (ID: `Kyxx3eZlncSRG4Dt`) — polling 15 min

---

## DÉCISIONS TECHNIQUES

1. **Architecture unifiée** : 1 app pour toutes les matières, routing par `subject`
2. **PDF client-side** : jspdf + pdf-lib (pas de SSR headless browser)
3. **Template persistence** : `template_json` JSONB dans `user_profiles`
4. **Référentiels TypeScript** : constants exportées, tree-shakable, pas de fetch runtime
5. **Conformité FWB** : injection automatique du référentiel dans CHAQUE prompt
6. **Freemium server-side** : vérification quota dans la route API, pas côté client
7. **Correction scan** : multi-copies en un seul upload, remédiation auto déclenchée
8. **Vocal RGPD** : consentement parental obligatoire avant enregistrement

---

## RÈGLES DE DÉVELOPPEMENT

- Fichiers complets uniquement (pas d'extraits partiels)
- TypeScript strict — zéro erreur
- Labels et statuts en français dans l'UI
- Pas de nouvelle table Supabase si une colonne JSONB suffit
- Le bug Next.js 15 async params dans `remediations/[id]/route.ts` est pré-existant — ne pas toucher

---

## ROUTES PROTÉGÉES (middleware.ts)

Toutes ces routes nécessitent un cookie Supabase Auth :
`/teacher`, `/parent`, `/admin`, `/onboarding`, `/direction`, `/competences`, `/bulletins`, `/evaluations`, `/apprentissages`, `/agenda`, `/absences`, `/eleves`, `/eleve`, `/discipline`, `/import`, `/dashboard`, `/classe`, `/remediations`, `/outils`, `/generateur`, `/historique`, `/creer-evaluation`, `/planification`, `/seances-remediation`

---

## LANDING PAGE

### V1 (originale)
- **Fichier :** `landingpage.html` (racine du projet) + `klasbook-site/index.html`
- **Hébergement :** Netlify (klasbook-site)
- **Design :** DM Sans, bleu #4f7cff, violet #9b7bff, rose #ff5a7a, gradient rouge→bleu

### V2 (test — avril 2026)
- **Fichier :** `landingpage-v2.html` (racine) + `public/presentation/index.html`
- **URL publique :** `klasbook.be/presentation`
- **Hébergement :** Vercel (via `public/` Next.js)
- **Design :** Plus Jakarta Sans, bleu confiance #2563EB, CTA orange #F97316, icônes SVG (plus d'emojis), style Trust & Authority (skill UI/UX Pro Max)
- **Nouvelles sections :** stats bar (2h+, 7 matières, 25+ exercices, 100% FWB), témoignages (3 profs), trust badges (RGPD, FWB, créé par un prof, IA de pointe)
- **Skill utilisé :** UI/UX Pro Max (`~/.claude/skills/ui-ux-pro-max` + `.claude/skills/ui-ux-pro-max`)

### Déploiement Vercel
- Projet lié à Vercel : `mamusciapasquale85-6856s-projects/klasbook-dev`
- Repo GitHub : `mamusciapasquale85-pixel/cote-platform`
- Déploiement auto sur push `main` → `klasbook.be`
- Config : `.vercel/` créé en avril 2026

---

## PROCHAINES ÉTAPES

- [ ] Configurer les vrais Price IDs Stripe (remplacer les placeholders)
- [ ] Décider si la landing V2 remplace la V1 sur la page d'accueil (`/`)
- [ ] Aligner la page pricing in-app (`/pricing`) sur 19€/mois
- [ ] Appliquer le fix course_id dans `/api/evaluation-templates/[id]/distribute/route.ts`
- [ ] Ajouter types de compétences FWB (EE, CA, EOSI, EOI, CL) aux évaluations sommatives
- [ ] Structured evaluation formatting (titres, sous-titres, header Klasbook)
- [ ] Sauvegarde systématique des exercices générés en base (table `exercices`)
- [ ] Vérifier le polling n8n "Alerte élève en difficulté" (15 min → plus fréquent ?)
- [x] Projet lié à Vercel avec déploiement auto (avril 2026)
- [x] Landing page V2 déployée sur `klasbook.be/presentation` (avril 2026)

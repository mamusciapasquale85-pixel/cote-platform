# Memory — Klasbook

## 🔑 Directive principale
**Être le plus économique possible en tokens.** Réponses courtes, précises, sans répétition ni préambule. Aller droit au but. Pas de recap inutile.

## Projet
**Klasbook** — app de gestion de classe pour profs FWB (Fédération Wallonie-Bruxelles).
Objectif : 2e salaire via vente/location à d'autres profs.
Stack : Next.js 15, TypeScript strict, React 19, Supabase (PostgreSQL), Vercel, Claude API.

## Pasquale
- Prof de néerlandais, LAB Marie Curie, Bruxelles (FWB)
- Classes : 3e secondaire (priorité, niveau très faible A1), 1re/2e, spécialisé
- Manuel : Tandem Brio
- Repo : `/Users/pasquale/cote-platform` | GitHub : `mamusciapasquale85-pixel/cote-platform`
- Supabase project : `wvgluiycajijcpfifrjv`
- Vercel project : `prj_bWwh8xcbpo6vlnhGl1cW3lZRwbVw`, team `team_L9aq04PF8K0epmFfLGSdSWqe`
- DNS : `klasbook.be` → Vercel (ns1/ns2.vercel-dns.com)

## Stack technique
| Terme | Signification |
|-------|--------------|
| niveaux | NI/I/S/B/TB (avec couleurs : TB=vert, B=vert clair, S=jaune, I=orange, NI=rouge) |
| gradient | `linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)` |
| sidebar | `#0f172a` |
| démo | compte `demo@klasbook.be` / `KlasbookDemo2025!` |
| service role key | dans Vercel env vars comme `SUPABASE_SERVICE_ROLE_KEY` |

## Rôles Supabase
| Enum `membership_role` | Usage |
|------------------------|-------|
| `admin` | Direction |
| `teacher` | Prof |
| `parent` | Parent |

## Pages clés
| Route | Description |
|-------|-------------|
| `/competences` | Grille compétences FWB + export PDF |
| `/bulletins` | Bulletins FWB + appréciation IA + PDF |
| `/parent` | Portail parent — résultats + remarques |
| `/direction` | Portail direction — vue globale école |
| `/accept-invitation` | Activation compte parent après invite email |

## Skills disponibles
- **prof-neerlandais** : tout ce qui touche à l'enseignement NL (cours, exercices, grammaire, eval, gamification, FWB)
- **pptx / docx / pdf / xlsx** : création de fichiers Office
- **data:analyze** etc. : analyse de données

## Préférences de travail
- Commits via `osascript` (pas git en VM — index.lock problem)
- Toujours vérifier les déploiements via Vercel MCP après push
- PDF : jsPDF côté client
- Middleware : protège toutes les routes app (evaluations, agenda, eleves, etc.)

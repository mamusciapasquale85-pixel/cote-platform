# Klasbook — État courant
> Se réécrit après chaque tâche. Ne pas modifier manuellement.

## Derniers commits
- `fix: onboarding — redirect admin vers /direction + RLS corrigées`
- `fix: demo login via API route (service role session)`
- `fix: competences/bulletins — relation ambiguë student_enrollments→students`

## État des fonctionnalités
| Feature | État |
|---------|------|
| Auth + onboarding | ✅ |
| Portail prof (ProfShell) | ✅ |
| Compétences FWB + PDF | ✅ |
| Bulletins FWB + IA | ✅ |
| Portail parent | ✅ |
| Portail direction | ✅ |
| Génération exercices IA (7 matières) | ✅ |
| Créer évaluation + PDF canevas | ✅ |
| Inspecteur FWB (chatbot) | ✅ |
| Page élève (passer exercices) | ❌ à faire |
| Sauvegarde exercices en base | ❌ à faire |

## Décision en cours
Aucune décision suspendue.

## Next steps prioritaires
1. Page élève — interface pour passer les exercices générés
2. Sauvegarde exercices (`table exercices` ou colonne JSONB ?)
3. Historique évaluations par classe

## Points d'attention actifs
- Bug Next.js 15 async params dans `remediations/[id]/route.ts` → ne pas toucher
- Commits via `osascript` uniquement (pas git en VM)
- Demo : `demo@klasbook.be` / `KlasbookDemo2025!`

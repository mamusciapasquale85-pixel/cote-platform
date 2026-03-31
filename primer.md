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
| Remédiations (Supabase + n8n + Airtable) | ✅ |
| Page élève (passer exercices) | ✅ `/eleve/[id]` |
| Sauvegarde exercices en base (`exercices` table) | ✅ generer-exercice/route.ts ligne 1039 |
| Historique exercices par classe | ✅ `/historique` |
| Module vocal (Azure Speech TTS+STT) | ❌ à faire |

## Décision en cours
Aucune décision suspendue.

## Next steps prioritaires
1. **Module vocal MVP** — NL, 1 thème A1 ("Se présenter")
   - Table `vocal_sessions` à créer en Supabase
   - `src/app/api/vocal-session/route.ts`
   - `src/app/vocal/page.tsx`
   - `src/components/vocal/VocalPlayer.tsx`
   - `src/components/vocal/VocalRecorder.tsx`
   - `src/components/vocal/PronunciationFeedback.tsx`
   - `src/lib/azure-speech.ts`
2. Dashboard enseignant pour le module vocal
3. Extension EN + ES

## Points d'attention actifs
- Bug Next.js 15 async params dans `remediations/[id]/route.ts` → ne pas toucher
- Commits via `osascript` uniquement (pas git en VM)
- Demo : `demo@klasbook.be` / `KlasbookDemo2025!`
- Azure Speech : AZURE_SPEECH_KEY + AZURE_SPEECH_REGION=westeurope (à ajouter dans .env.local et Vercel)

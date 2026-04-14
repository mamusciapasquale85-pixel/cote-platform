// app/api/remediations/generer/route.ts
// Route API sécurisée – clé Anthropic côté serveur uniquement
// Génère les exercices ET sauvegarde dans Supabase (remediations.exercice_propose + corrige_genere)

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// ─── Clients ──────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Service role pour écrire dans remediations sans RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Construction du prompt ───────────────────────────────────────────────────

type Competence = "grammaire" | "conjugaison" | "vocabulaire" | "comprehension" | "expression";

function normalizeCompetence(raw: string): Competence {
  if (!raw) return "grammaire";
  const r = raw.toLowerCase();
  if (r.includes("conjugaison")) return "conjugaison";
  if (r.includes("vocabulaire")) return "vocabulaire";
  if (r.includes("comprehension") || r.includes("compréhension") || r.includes("lecture")) return "comprehension";
  if (r.includes("expression")) return "expression";
  if (r.includes("grammaire")) return "grammaire";
  return "grammaire";
}

function buildPrompt(competence: Competence, niveau: string, theme: string, eleveNom: string): string {
  const ctx = `Élève : ${eleveNom || "élève"} | Niveau : ${niveau} | Thème : ${theme} | Matière : néerlandais (langue étrangère)`;
  const base = `Tu es professeur de NÉERLANDAIS (langue étrangère) dans le secondaire belge (FWB). ${ctx}.
RÈGLE ABSOLUE N°1 : tu génères des exercices de LANGUE NÉERLANDAISE uniquement. Jamais de conjugaison française, jamais de grammaire française.
RÈGLE ABSOLUE N°2 : toutes les phrases d'exercice, exemples, textes et mots sont EN NÉERLANDAIS (nl). Seules les consignes, explications théoriques et corrigés sont en français.
RÈGLE ABSOLUE N°3 : les verbes conjugués, les mots à trouver, les phrases à compléter sont tous issus du vocabulaire et de la grammaire NÉERLANDAISE.
Réponds en texte brut, sans markdown ni astérisques.\n\n`;

  switch (competence) {
    case "grammaire":
      return base + `Génère une FICHE DE REMÉDIATION EN GRAMMAIRE NÉERLANDAISE (pas française !) :

[INTRO THÉORIQUE]
En français : explique la règle grammaticale (max 6 lignes). Donne 3 exemples DE PHRASES EN NÉERLANDAIS avec leur traduction française entre parenthèses.

[EXERCICE TYPE 1 – Compléter les blancs]
Consigne en français. Puis 10 PHRASES EN NÉERLANDAIS avec un blanc à compléter. Numérotées 1 à 10. TOUTES les phrases sont en néerlandais.

[EXERCICE TYPE 2 – QCM]
Consigne en français. Puis 10 QUESTIONS EN NÉERLANDAIS à choix multiple (A/B/C), les 3 options aussi en néerlandais. Numérotées 1 à 10.

[CORRIGÉ TYPE 1]
10 réponses en néerlandais numérotées.

[CORRIGÉ TYPE 2]
10 lettres de réponse (A, B ou C) numérotées.`;

    case "conjugaison":
      return base + `Génère une FICHE DE REMÉDIATION EN CONJUGAISON NÉERLANDAISE (pas française !) :

[INTRO THÉORIQUE]
En français : explique le temps verbal ou la règle (max 6 lignes). Donne le paradigme complet en néerlandais (ik, jij, hij/zij, wij, jullie, zij) avec traduction.

[EXERCICE TYPE 1 – Conjuguer]
Consigne en français. Puis 10 PHRASES EN NÉERLANDAIS avec le verbe à l'infinitif entre parenthèses à conjuguer. Numérotées 1 à 10. TOUTES les phrases sont en néerlandais.

[EXERCICE TYPE 2 – Corriger les erreurs]
Consigne en français. Puis 10 PHRASES EN NÉERLANDAIS contenant une erreur de conjugaison à corriger. Numérotées 1 à 10.

[CORRIGÉ TYPE 1]
10 formes conjuguées en néerlandais numérotées.

[CORRIGÉ TYPE 2]
10 phrases corrigées en néerlandais numérotées.`;

    case "vocabulaire":
      return base + `Génère une FICHE DE REMÉDIATION EN VOCABULAIRE :

[INTRO – CHAMP LEXICAL]
15 MOTS EN NÉERLANDAIS du thème "${theme}" avec traduction française et une phrase exemple EN NÉERLANDAIS pour chaque mot.

[EXERCICE TYPE 1 – Associer]
Consigne en français. Puis 10 MOTS EN NÉERLANDAIS numérotés 1 à 10, à associer à leur traduction française (liste A-J mélangée fournie).

[EXERCICE TYPE 2 – Compléter]
Consigne en français + liste de 12 mots EN NÉERLANDAIS. Puis 10 PHRASES EN NÉERLANDAIS avec un mot manquant. Numérotées 1 à 10.

[CORRIGÉ TYPE 1]
10 associations numérotées (néerlandais = français).

[CORRIGÉ TYPE 2]
10 mots néerlandais numérotés.`;

    case "comprehension":
      return base + `Génère une FICHE DE REMÉDIATION EN COMPRÉHENSION ÉCRITE :

[TEXTE NÉERLANDAIS]
INTÉGRALEMENT EN NÉERLANDAIS. Texte de niveau A1/A2, exactement 15 lignes, sur le thème "${theme}". Vocabulaire simple et accessible. NE PAS traduire le texte.

[QUESTIONS DE COMPRÉHENSION]
5 questions EN FRANÇAIS sur le texte. Numérotées 1 à 5.

[CORRIGÉ]
5 réponses EN FRANÇAIS numérotées.`;

    case "expression":
      return base + `Génère une FICHE DE REMÉDIATION EN EXPRESSION ÉCRITE :

[INTRO ET CONSIGNE]
En français : explique comment structurer un texte court en néerlandais. Donne une liste de connecteurs utiles EN NÉERLANDAIS avec leur traduction.

[MODÈLE]
5 lignes EN NÉERLANDAIS sur le thème "${theme}". Puis traduction française complète en dessous.

[EXERCICE]
Consigne en français. Puis 5 AMORCES DE PHRASES EN NÉERLANDAIS pour guider l'élève (ex: "Mijn naam is... / Ik woon in...").

[CORRIGÉ / EXEMPLE ATTENDU]
5 lignes EN NÉERLANDAIS constituant un exemple de réponse acceptable.`;

    default:
      return base + `Génère une fiche de remédiation en néerlandais adaptée au niveau ${niveau}. Inclus une explication théorique en français, des exemples en néerlandais et un exercice de 10 items en néerlandais avec corrigé.`;
  }
}

// ─── Handler POST ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { competence: rawCompetence, theme, niveau, eleveNom, eleve_nom, remediationId } = await req.json();

    if (!remediationId) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const competence = normalizeCompetence(rawCompetence ?? "");
    const prompt = buildPrompt(competence, niveau ?? "1re secondaire", theme ?? "Remédiation ciblée", eleveNom ?? eleve_nom ?? "élève");

    // ── Appel Anthropic ──
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const texte = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    // ── Sauvegarde dans Supabase ──
    const { error: dbError } = await supabase
      .from("remediations")
      .update({
        exercice_propose: { texte_brut: texte },
        theme,
        competence,
        niveau,
        exercice_genere_at: new Date().toISOString(),
      })
      .eq("id", remediationId);

    if (dbError) {
      console.warn("[generer] Avertissement Supabase :", dbError.message);
      // On renvoie quand même le texte même si la sauvegarde échoue
    }

    return NextResponse.json({
      exercice: texte,
      titre: `Remédiation ${competence} — ${theme ?? "néerlandais"}`,
      sauvegarde: !dbError,
    });
  } catch (err) {
    console.error("[generer] Erreur :", err);
    return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
  }
}

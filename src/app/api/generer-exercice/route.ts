import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Langue = "nl" | "en";
type Niveau = "A1" | "A2" | "B1" | "B2";

type ExerciceRequest = {
  type_exercice?: string;
  niveau?: string;
  theme?: string;
  langue?: string;
  attendu?: string;
  contexte_remediation?: string;
};

const EXERCISE_LABELS: Record<string, string> = {
  lacunes: "Phrases à trous",
  qcm: "QCM",
  mots_meles: "Mots mêlés",
  associer: "Exercice d'association",
  dialogue: "Dialogue à compléter",
  vocabulaire_images: "Vocabulaire",
  traduction: "Traduction",
  conjugaison: "Conjugaison",
  remise_ordre: "Remise en ordre",
  lecture: "Compréhension écrite",
  flashcards: "Flashcards",
  kahoot_csv: "Questions Kahoot",
};

function toNiceError(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message) {
      return error.message;
    }
    if (
      "error_description" in error &&
      typeof error.error_description === "string" &&
      error.error_description
    ) {
      return error.error_description;
    }
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function normalizeLangue(input: string | undefined): Langue {
  const value = (input ?? "nl").trim().toLowerCase();
  return value === "en" ? "en" : "nl";
}

function normalizeNiveau(input: string | undefined): Niveau {
  const value = (input ?? "A1").trim().toUpperCase();
  if (value === "A2" || value === "B1" || value === "B2") return value;
  return "A1";
}

function buildPrompt(params: {
  typeExercice: string;
  niveau: Niveau;
  theme: string;
  langue: Langue;
  attendu?: string;
  contexteRemediation?: string;
}) {
  const { typeExercice, niveau, theme, langue, attendu, contexteRemediation } = params;
  const langueLabel = langue === "nl" ? "néerlandais" : "anglais";

  const base = `Tu es un professeur de ${langueLabel} expert pour le 1er degré du secondaire en Fédération Wallonie-Bruxelles.
Crée un exercice en ${langueLabel} sur le thème "${theme}", niveau ${niveau}.
${attendu ? `\n\nL'élève a une lacune identifiée sur : "${attendu}". Cible cet apprentissage précisément.` : ""}
${contexteRemediation ? `\nContexte : ${contexteRemediation}` : ""}`;

  const prompts: Record<string, string> = {
    lacunes: `${base}\nCrée un texte à trous (~120 mots) en néerlandais. Fournis : 1) le texte original complet, 2) le texte avec ___ à la place de 12-15 mots clés, 3) la liste des mots manquants dans le désordre (banque de mots), 4) le corrigé avec les critères d'évaluation.`,
    qcm: `${base}\nCrée 10 questions à choix multiples (4 options chacune, lettre A/B/C/D) en néerlandais. Pour chaque question, indique clairement les 4 options. Fournis ensuite le corrigé avec la bonne lettre + justification courte pour chaque réponse.`,
    mots_meles: `${base}\nCrée un exercice de mots mêlés pédagogique sur le thème "${theme}" niveau ${niveau}. Fournis : 1) une liste de 12 mots à retrouver en néerlandais avec leur traduction française, 2) une grille ASCII de 12x12 lettres avec les mots cachés horizontalement, verticalement et en diagonale, 3) le corrigé avec la position de chaque mot dans la grille (ligne, colonne, direction).`,
    associer: `${base}\nCrée un exercice d'association en deux colonnes : colonne A (15 mots/expressions en néerlandais) et colonne B (15 traductions/définitions/synonymes en français ou néerlandais), dans le désordre. L'élève doit relier chaque élément de A à son correspondant en B. Fournis l'exercice puis le corrigé (ex: A1-B7, A2-B3…).`,
    dialogue: `${base}\nCrée un dialogue naturel en néerlandais (~16 répliques) entre deux personnes sur le thème "${theme}". 7-8 répliques sont à compléter par l'élève (remplacées par ___). Fournis : 1) le dialogue incomplet avec les numéros de répliques manquantes, 2) la banque de répliques dans le désordre, 3) le dialogue complet en corrigé.`,
    vocabulaire_images: `${base}\nCrée un exercice d'association vocabulaire : 15 mots en néerlandais avec leur traduction française en deux colonnes mélangées. L'élève relie chaque mot à sa traduction. Puis fournis une version "exercice seul" et le corrigé.`,
    traduction: `${base}\nCrée 8 phrases à traduire NL→FR et 8 phrases à traduire FR→NL (niveau ${niveau}). Phrases courtes, contextualisées sur le thème. Fournis les deux séries puis le corrigé complet.`,
    conjugaison: `${base}\nCrée 15 phrases avec un verbe à conjuguer (infinitif entre parenthèses) ou une règle grammaticale à appliquer pour le niveau ${niveau}. Fournis l'exercice puis le corrigé avec la règle expliquée pour chaque réponse.`,
    remise_ordre: `${base}\nCrée 10 phrases en néerlandais dont les mots sont dans le désordre. Mets les mots séparés par des barres obliques. Fournis l'exercice désordonné puis le corrigé avec la phrase correcte.`,
    lecture: `${base}\nCrée un exercice de compréhension écrite : 1) un texte authentique et engageant en néerlandais (~160 mots), 2) 3 questions de compréhension globale, 3) 4 questions sur des informations précises, 4) 1 question d'inférence, 5) le corrigé détaillé.`,
    flashcards: `${base}\nCrée 20 flashcards vocabulaire. Format strict : mot néerlandais | traduction française | exemple d'utilisation en néerlandais. Une flashcard par ligne, séparée par |.`,
    kahoot_csv: `${base}\nCrée 10 questions pour Kahoot en néerlandais. Format : Question / A: réponse / B: réponse / C: réponse / D: réponse / Correcte: lettre. Une question par bloc.`,
  };

  return prompts[typeExercice] ?? base;
}

function extractAnthropicText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";

  const chunks = content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      if ((item as { type?: string }).type !== "text") return "";
      return (item as { text?: string }).text ?? "";
    })
    .filter((text) => typeof text === "string" && text.trim().length > 0);

  return chunks.join("\n\n").trim();
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = (await req.json()) as ExerciceRequest;

    const typeExercice = (body.type_exercice ?? "lacunes").trim() || "lacunes";
    const niveau = normalizeNiveau(body.niveau);
    const langue = normalizeLangue(body.langue);
    const theme = (body.theme ?? body.attendu ?? "Remédiation ciblée").trim();
    const attendu = body.attendu?.trim() || undefined;
    const contexteRemediation = body.contexte_remediation?.trim() || undefined;

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY manquante dans .env.local" },
        { status: 500 }
      );
    }

    const prompt = buildPrompt({
      typeExercice,
      niveau,
      theme,
      langue,
      attendu,
      contexteRemediation,
    });

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const anthropicPayload = (await anthropicResponse.json().catch(() => ({}))) as unknown;

    if (!anthropicResponse.ok) {
      const apiError =
        (anthropicPayload as { error?: { message?: string } })?.error?.message ||
        toNiceError(anthropicPayload);
      return NextResponse.json(
        { error: `Erreur Anthropic: ${apiError}` },
        { status: anthropicResponse.status }
      );
    }

    const exercice = extractAnthropicText(anthropicPayload);
    if (!exercice) {
      return NextResponse.json(
        { error: "Réponse Anthropic vide. Réessaie avec un autre type d'exercice." },
        { status: 502 }
      );
    }

    const typeLabel = EXERCISE_LABELS[typeExercice] ?? "Exercice";
    const titre = `${typeLabel} – ${theme} (${niveau})`;

    return NextResponse.json({ exercice, titre });
  } catch (error: unknown) {
    return NextResponse.json({ error: toNiceError(error) }, { status: 500 });
  }
}

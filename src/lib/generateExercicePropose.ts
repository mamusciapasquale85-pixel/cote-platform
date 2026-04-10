/**
 * generateExercicePropose.ts
 *
 * Helper partagé : génère un exercice de remédiation via l'IA (Claude Haiku)
 * et le stocke dans remediation.exercice_propose.
 *
 * Appelé en arrière-plan (fire & forget) après la création d'une remédiation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Mapping nom de cours → identifiant matière ────────────────────────────

const COURSE_TO_SUBJECT: [RegExp, string][] = [
  [/neerl|néerl|dutch/i, "nl"],
  [/angl|english/i, "en"],
  [/math/i, "mathematiques"],
  [/scien|bio(?:log)?|chim|phys/i, "sciences"],
  [/histoir/i, "histoire"],
  [/géo|geo/i, "geographie"],
  [/fran[çc]/i, "francais"],
  [/langues?\s+mod/i, "langues_modernes"],
];

export function courseNameToSubject(name: string): string {
  for (const [re, id] of COURSE_TO_SUBJECT) {
    if (re.test(name)) return id;
  }
  return "nl";
}

// ─── Type par défaut selon matière ─────────────────────────────────────────

const DEFAULT_TYPE: Record<string, string> = {
  nl:              "lacunes",
  en:              "lacunes",
  mathematiques:   "calcul",
  sciences:        "qcm_sc",
  histoire:        "qcm_hist",
  geographie:      "qcm_geo",
  francais:        "lecture_fr",
  langues_modernes:"lacunes",
};

// ─── Niveaux valides ────────────────────────────────────────────────────────

const LANG_NIVEAUX = ["A1", "A2", "B1", "B2"];
const SEC_NIVEAUX  = ["1S", "2S", "3S", "4S", "5S", "6S"];

function normalizeNiveau(input: string | null | undefined, subject: string): string {
  if (!input) return isLangSubject(subject) ? "A1" : "1S";
  const v = input.trim().toUpperCase();
  if ([...LANG_NIVEAUX, ...SEC_NIVEAUX].includes(v)) return v;
  return isLangSubject(subject) ? "A1" : "1S";
}

function isLangSubject(subject: string) {
  return ["nl", "en", "langues_modernes"].includes(subject);
}

// ─── Prompt simplifié pour remédiation automatique ─────────────────────────

function buildRemedialPrompt(params: {
  subject: string;
  typeExercice: string;
  niveau: string;
  theme: string;
  attendu?: string;
}): string {
  const { subject, typeExercice, niveau, theme, attendu } = params;

  const langLabel =
    subject === "nl" ? "néerlandais"
    : subject === "en" ? "anglais"
    : subject === "mathematiques" ? "mathématiques"
    : subject === "sciences" ? "sciences"
    : subject === "histoire" ? "histoire"
    : subject === "geographie" ? "géographie"
    : subject === "francais" ? "français"
    : "langue";

  const base = `Tu es un professeur expert en ${langLabel} pour le secondaire en Fédération Wallonie-Bruxelles.
Génère un exercice de REMÉDIATION ciblé, concis (max 400 mots hors corrigé), immédiatement utilisable.

Thème / Lacune visée : "${attendu || theme}" | Niveau : ${niveau}
Type d'exercice : ${typeExercice}

RÈGLES :
- Énoncés clairs en français (consignes), exercices en ${langLabel}
- Progression simple (3 à 8 questions/items selon le type)
- Toujours un CORRIGÉ complet à la fin
- PAS de LaTeX ni Markdown complexe — texte brut uniquement
- PAS d'emojis
- Titre court en majuscules en première ligne

Commence directement par le titre, puis l'exercice.`;

  return base;
}

// ─── Extraction texte Anthropic ─────────────────────────────────────────────

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c && typeof c === "object" && (c as { type?: string }).type === "text")
    .map((c) => (c as { text?: string }).text ?? "")
    .join("\n")
    .trim();
}

// ─── Fonction principale ────────────────────────────────────────────────────

export async function generateExercicePropose(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  remediationId: string;
  subject: string;
  niveauRaw?: string | null;
  attendu?: string | null;
  evaluationTitre?: string | null;
}): Promise<void> {
  const { supabase, remediationId, subject, niveauRaw, attendu, evaluationTitre } = params;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return;

  const niveau = normalizeNiveau(niveauRaw, subject);
  const typeExercice = DEFAULT_TYPE[subject] ?? "lacunes";
  const theme = (attendu || evaluationTitre || "Remédiation").trim();

  const prompt = buildRemedialPrompt({ subject, typeExercice, niveau, theme, attendu: attendu ?? undefined });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // Haiku : rapide + économique pour tâche background
        max_tokens: 1800,
        system:
          "Tu es un professeur expert en remédiation scolaire en Belgique (FWB). " +
          "Tu génères des exercices ciblés, clairs et directement utilisables.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) return;

    const payload = await response.json().catch(() => null);
    const contenu = extractText(payload);
    if (!contenu) return;

    // Extraire le titre de la première ligne (si tout en majuscules)
    const firstLine = contenu.split("\n")[0]?.trim() ?? "";
    const titre =
      /^[A-ZÉÈÀÙÂÊÎÔÛ\s0-9–:.,]{4,}$/.test(firstLine)
        ? firstLine
        : `Remédiation – ${theme} (${niveau})`;

    await supabase
      .from("remediations")
      .update({
        exercice_propose: { titre, contenu, subject, type_exercice: typeExercice, niveau },
        subject,
        niveau,
      })
      .eq("id", remediationId);
  } catch {
    // Non bloquant — on ne fait rien si ça échoue
  }
}

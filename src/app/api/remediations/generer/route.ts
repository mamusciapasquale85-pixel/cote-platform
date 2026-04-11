import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Types ─────────────────────────────────────────────────────────────────────

type GenererRequest = {
  remediationId?: string;
  type_exercice?: string;
  niveau?: string;
  theme?: string;
  competence?: string;
  eleve_nom?: string;
};

type AnthropicContent = { type: string; text?: string };
type AnthropicPayload = {
  content?: AnthropicContent[];
  error?: { message?: string };
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e)
    return String((e as { message: unknown }).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}

function extractText(payload: AnthropicPayload): string {
  return (
    payload.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

const EXERCISE_LABELS: Record<string, string> = {
  lacunes:          "Texte à trous",
  qcm:              "QCM",
  associer:         "Association",
  conjugaison:      "Conjugaison",
  lecture:          "Compréhension",
  expression_ecrite:"Expression écrite",
  flashcards:       "Flashcards",
  remise_ordre:     "Remise en ordre",
  dialogue:         "Dialogue",
  vocabulaire_images:"Vocabulaire",
  traduction:       "Traduction",
};

function buildPrompt(params: {
  typeExercice: string;
  niveau: string;
  theme: string;
  competence?: string;
  eleveNom: string;
}): string {
  const { typeExercice, niveau, theme, competence, eleveNom } = params;
  const typeLabel = EXERCISE_LABELS[typeExercice] ?? typeExercice;

  return `Tu es un professeur expert du secondaire en Fédération Wallonie-Bruxelles (FWB).
Tu crées des exercices pédagogiques de haute qualité, engageants et immédiatement utilisables en classe.

CONTEXTE DE REMÉDIATION :
- Élève : ${eleveNom}
- Niveau : ${niveau}
- Thème / lacune ciblée : "${theme}"
${competence ? `- Compétence travaillée : ${competence.replace(/_/g, " ")}` : ""}
- Type d'exercice à générer : ${typeLabel}

RÈGLES :
- Adapte le contenu précisément au niveau ${niveau} (secondaire FWB)
- L'exercice doit cibler directement la lacune indiquée
- Structure claire : consigne → exercice → CORRIGÉ complet à la fin
- Contenu authentique et motivant pour un adolescent de 12-18 ans
- Fournis systématiquement la correction complète

La PREMIÈRE ligne de ta réponse doit être le titre de l'exercice (sans ## ni formatage, juste le texte du titre).
Ensuite génère le ${typeLabel} complet sur : "${theme}".`;
}

// ─── POST /api/remediations/generer ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Auth
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Parse body
    const body = (await req.json().catch(() => ({}))) as GenererRequest;
    const remediationId = body.remediationId?.trim();
    const typeExercice  = (body.type_exercice ?? "lacunes").trim();
    const niveau        = (body.niveau ?? "1S").trim();
    const theme         = (body.theme ?? "Remédiation ciblée").trim();
    const competence    = body.competence?.trim();
    const eleveNom      = (body.eleve_nom ?? "L'élève").trim();

    // Optionally verify remédiation ownership
    if (remediationId) {
      const { data: rem, error: remErr } = await supabase
        .from("remediations")
        .select("id")
        .eq("id", remediationId)
        .single();
      if (remErr || !rem) {
        return NextResponse.json({ error: "Remédiation introuvable" }, { status: 404 });
      }
    }

    // Anthropic
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY manquante dans .env.local" },
        { status: 500 }
      );
    }

    const prompt = buildPrompt({ typeExercice, niveau, theme, competence, eleveNom });

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const anthropicPayload = (await anthropicRes.json().catch(() => ({}))) as AnthropicPayload;

    if (!anthropicRes.ok) {
      const apiError = anthropicPayload.error?.message ?? toNiceError(anthropicPayload);
      return NextResponse.json(
        { error: `Erreur Anthropic : ${apiError}` },
        { status: anthropicRes.status }
      );
    }

    const raw = extractText(anthropicPayload);
    if (!raw) {
      return NextResponse.json({ error: "Réponse vide de Claude." }, { status: 500 });
    }

    // First non-empty line = titre
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    const titre   = lines[0] ?? "Exercice généré";
    const exercice = raw;

    // Save to Supabase with service role key (best-effort, bypasses RLS)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (serviceKey && remediationId) {
      const adminClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        { cookies: { getAll: () => [], setAll: () => {} } }
      );
      await adminClient
        .from("remediations")
        .update({
          generated_exercice: exercice,
          generated_exercice_at: new Date().toISOString(),
        })
        .eq("id", remediationId);
    }

    return NextResponse.json({ exercice, titre });
  } catch (e: unknown) {
    return NextResponse.json({ error: toNiceError(e) }, { status: 500 });
  }
}

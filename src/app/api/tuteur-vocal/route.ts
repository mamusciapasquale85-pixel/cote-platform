import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MATIERES: Record<string, string> = {
  nl:        "néerlandais (langue étrangère pour des élèves francophones belges)",
  en:        "anglais (langue étrangère pour des élèves francophones belges)",
  maths:     "mathématiques",
  histoire:  "histoire (programme FWB)",
  geo:       "géographie",
  sciences:  "sciences (biologie, physique, chimie)",
  fr:        "français (langue maternelle, grammaire et littérature)",
  autre:     "matière scolaire générale",
};

export async function POST(request: NextRequest) {
  try {
    const { question, matiere = "autre" } = await request.json() as { question: string; matiere: string };
    if (!question?.trim()) return NextResponse.json({ error: "Question requise" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante" }, { status: 500 });

    const matiereLabel = MATIERES[matiere] ?? MATIERES.autre;

    const systemPrompt = `Tu es un tuteur pédagogique expert en ${matiereLabel}, travaillant avec des élèves du secondaire en Fédération Wallonie-Bruxelles (FWB).
Réponds à la question de l'élève de façon claire, pédagogique et bienveillante.
Règles :
- Réponse en FRANÇAIS uniquement (sauf si la question porte sur une langue étrangère et nécessite des exemples dans cette langue)
- Longueur : 3 à 6 phrases maximum, adaptées à la lecture à voix haute
- Pas de listes à puces, pas de markdown — texte continu naturel pour être lu à voix haute
- Commence directement par l'explication, sans formule de politesse
- Termine par une courte encouragement ou question de vérification si pertinent`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: question.trim() }],
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      return NextResponse.json({ error: `Erreur Claude : ${res.status} — ${msg}` }, { status: 500 });
    }

    const payload = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const explication = payload.content?.find(c => c.type === "text")?.text?.trim() ?? "";

    return NextResponse.json({ explication });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from("school_memberships")
      .select("matiere, school_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const matiere = membership?.matiere ?? "Non définie";

    const body = await req.json() as { contenu: string; nom_fichier?: string };
    const { contenu, nom_fichier } = body;
    if (!contenu?.trim()) return NextResponse.json({ error: "Contenu manquant" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante" }, { status: 500 });

    const prompt = `Tu es un assistant d'import de résultats scolaires pour Klasbook (FWB - Belgique francophone).
Un professeur de "${matiere}" t'envoie un extrait de ses résultats (copié depuis Excel, Google Sheets, CSV ou Pronote).
Fichier : ${nom_fichier ?? "non précisé"}

CONTENU BRUT :
\`\`\`
${contenu.slice(0, 6000)}
\`\`\`

SYSTÈME DE NOTATION FWB : TB (Très Bien), B (Bien), S (Satisfaisant), I (Insuffisant), NI (Non atteint)
Si notes numériques, convertis :
- 80-100% → TB | 65-79% → B | 50-64% → S | 30-49% → I | 0-29% → NI

I et NI déclenchent une remédiation automatique dans Klasbook.

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de backticks) :
{
  "ok": true,
  "evaluation": {
    "titre": "titre détecté ou déduit",
    "date": "YYYY-MM-DD ou null",
    "matiere": "${matiere}",
    "classe": "nom de classe ou null"
  },
  "resultats": [
    { "prenom": "prénom", "nom": "nom de famille", "level": "TB|B|S|I|NI", "value": null, "note_originale": "valeur brute" }
  ],
  "nb_total": 0,
  "nb_remediation": 0,
  "avertissements": [],
  "colonnes_detectees": []
}
Si impossible : {"ok": false, "erreur": "explication"}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
    });

    const payload = await response.json() as { content?: { type: string; text: string }[]; error?: { message: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? "Erreur API");

    const text = payload.content?.find(c => c.type === "text")?.text ?? "";
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { return NextResponse.json({ error: "L'IA n'a pas pu analyser ce fichier." }, { status: 422 }); }

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json({ error: toNiceError(error) }, { status: 500 });
  }
}

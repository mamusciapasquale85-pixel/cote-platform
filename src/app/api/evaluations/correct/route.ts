import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

// ─── Types ────────────────────────────────────────────────────────────────────
export type GridQuestion = {
  id: string;
  num: number;
  text: string;
  type: "qcm" | "open" | "fill" | "points";
  points: number;
  competence?: string;
  expected_answer: string;
  options?: string[];
};

export type QuestionExtraction = {
  question_id: string;
  student_answer: string;
  suggested_score: number;
  max_score: number;
  needs_review: boolean;
  illegible?: boolean;
  note?: string;
};

export type StudentExtraction = {
  name: string;
  page_hint?: string;
  answers: QuestionExtraction[];
  total_suggested: number;
  total_max: number;
  score_sur_10?: number;
};

export type CorrectionResult = {
  students: StudentExtraction[];
  session_id?: string;
};

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante" }, { status: 500 });

    const form = await req.formData();
    const assessmentId   = form.get("assessment_id") as string | null;
    const pdfPath        = form.get("pdf_path") as string | null;
    const corrKeyPath    = form.get("correction_key_path") as string | null;

    if (!pdfPath || !assessmentId) {
      return NextResponse.json({ error: "pdf_path + assessment_id requis" }, { status: 400 });
    }
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(assessmentId)) {
      return NextResponse.json({ error: "assessment_id invalide: " + assessmentId }, { status: 400 });
    }

    // Telecharger les PDFs depuis Supabase Storage (pas de limite de taille)
    const { data: pdfBlob, error: dlErr } = await supabase.storage
      .from("correction-uploads").download(pdfPath);
    if (dlErr || !pdfBlob) throw new Error("Download copies: " + (dlErr?.message ?? "vide"));
    const pdfFile = new File([pdfBlob], "copies.pdf", { type: "application/pdf" });

    let correctionKey: File | null = null;
    if (corrKeyPath) {
      const { data: ckBlob, error: dlErr2 } = await supabase.storage
        .from("correction-uploads").download(corrKeyPath);
      if (dlErr2 || !ckBlob) throw new Error("Download corrige: " + (dlErr2?.message ?? "vide"));
      correctionKey = new File([ckBlob], "corrige.pdf", { type: "application/pdf" });
    }

    // ── Charger la grille depuis la DB ────────────────────────────────────────
    const { data: gridRow, error: gridErr } = await supabase
      .from("evaluation_grids")
      .select("questions, school_id")
      .eq("assessment_id", assessmentId)
      .maybeSingle();
    if (gridErr) console.error("[correct] evaluation_grids:", gridErr.message);

    const questions: GridQuestion[] = (gridRow?.questions ?? []) as GridQuestion[];
    const hasGrid = questions.length > 0;
    if (!hasGrid && !correctionKey) {
      return NextResponse.json({ error: "Aucune grille definie. Fournis un corrige officiel pour que l'IA puisse corriger." }, { status: 400 });
    }

    // ── Charger le titre de l'evaluation ─────────────────────────────────────
    const { data: assessment, error: assessErr } = await supabase
      .from("assessments")
      .select("title, max_points, school_id")
      .eq("id", assessmentId)
      .maybeSingle();
    if (assessErr) throw new Error("[assessments] " + assessErr.message);

    // ── Encoder les PDFs en base64 ────────────────────────────────────────────
    const pdfBuffer = await pdfFile.arrayBuffer();
    if (pdfBuffer.byteLength > 32 * 1024 * 1024) {
      return NextResponse.json({ error: "PDF copies trop volumineux (max 32 MB)" }, { status: 413 });
    }
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    let correctionKeyBase64: string | null = null;
    if (correctionKey) {
      const ckBuffer = await correctionKey.arrayBuffer();
      if (ckBuffer.byteLength > 32 * 1024 * 1024) {
        return NextResponse.json({ error: "PDF corrige trop volumineux (max 32 MB)" }, { status: 413 });
      }
      correctionKeyBase64 = Buffer.from(ckBuffer).toString("base64");
    }

    // ── Construire la grille en texte pour le prompt ──────────────────────────
    const gridText = hasGrid ? questions.map(q =>
      `Q${q.num} [${q.type.toUpperCase()}] (${q.points} pt${q.points > 1 ? "s" : ""}): ${q.text}\n   \u2192 Reponse attendue: ${q.expected_answer}${q.options ? `\n   Options: ${q.options.join(" / ")}` : ""}`
    ).join("\n\n") : "";

    const totalMax = hasGrid ? questions.reduce((s, q) => s + q.points, 0) : 0;

    // ── Construire le prompt ──────────────────────────────────────────────────
    let prompt: string;
    if (hasGrid) {
      const correctionKeyNote = correctionKeyBase64
        ? `Je te fournis egalement le CORRIGE OFFICIEL (document 1). Utilise-le comme reference principale pour evaluer les reponses des eleves.`
        : `Utilise la grille de correction ci-dessous comme reference.`;

      prompt = `Tu es un assistant de correction d'evaluations scolaires en Federation Wallonie-Bruxelles.

${correctionKeyNote}

${correctionKeyBase64 ? `Le document suivant contient les COPIES DES ELEVES (document 2).` : `Le document contient les copies des eleves.`}

EVALUATION: "${assessment?.title ?? ""}"

GRILLE DE CORRECTION (total: ${totalMax} points):
${gridText}

INSTRUCTIONS DE CORRECTION:
1. Identifie chaque copie d'eleve dans le PDF (nom generalement en haut de page ou sur une page de garde)
2. Pour chaque eleve, extrait ses reponses question par question
3. Questions QCM et textes a trous: score automatique base sur la correspondance exacte avec la reponse attendue (correct = max points, incorrect = 0, partiellement correct = points proportionnels)
4. Questions ouvertes: evalue en te basant sur les concepts-cles de la reponse attendue et du corrige officiel. Marque needs_review: true pour que le prof valide ton evaluation.
5. ECRITURE ILLISIBLE: si tu ne peux PAS lire la reponse d'un eleve a une question, mets illegible: true, needs_review: true, student_answer: "\u26a0 ILLISIBLE", suggested_score: 0, note: "Ecriture illisible - a verifier par le professeur". NE TENTE PAS d'interpreter une ecriture illisible.
6. Si l'eleve n'a rien ecrit du tout, mets student_answer: "" et suggested_score: 0

Retourne UNIQUEMENT un JSON valide avec cette structure exacte:
{
  "students": [
    {
      "name": "NOM Prenom",
      "page_hint": "pages 1-3",
      "answers": [
        {
          "question_id": "q1",
          "student_answer": "reponse copiee telle quelle",
          "suggested_score": 1.5,
          "max_score": 2,
          "needs_review": false,
          "illegible": false,
          "note": "explication si necessaire"
        }
      ],
      "total_suggested": 15.5,
      "total_max": ${totalMax},
      "score_sur_10": 7.75
    }
  ]
}

Important: total_suggested / total_max * 10, arrondi a 1 decimale = score_sur_10.
Si tu ne trouves pas de nom pour un eleve, utilise "Eleve inconnu (page X)".`;
    } else {
      prompt = `Tu es un assistant de correction d'evaluations scolaires en Federation Wallonie-Bruxelles.

Le DOCUMENT 1 est le CORRIGE OFFICIEL. Le DOCUMENT 2 contient les COPIES DES ELEVES.

EVALUATION: "${assessment?.title ?? ""}"

MODE SANS GRILLE PREDEFINIES : commence par analyser le corrige officiel pour identifier toutes les questions et leur bareme (si visible). Ensuite, pour chaque copie d'eleve :
1. Identifie le nom de l'eleve (haut de page ou page de garde)
2. Pour chaque question identifiee dans le corrige, evalue la reponse de l'eleve
3. Attribue un score coherent avec le bareme du corrige (ou proportionnel si bareme absent)
4. Marque needs_review: true pour toutes les questions - le prof doit valider
5. ECRITURE ILLISIBLE: illegible: true, student_answer: "\u26a0 ILLISIBLE", suggested_score: 0, needs_review: true
6. Utilise question_id: "q1", "q2"... dans l'ordre d'apparition dans le corrige

Retourne UNIQUEMENT un JSON valide:
{
  "students": [
    {
      "name": "NOM Prenom",
      "page_hint": "pages 1-3",
      "answers": [
        {
          "question_id": "q1",
          "student_answer": "reponse copiee",
          "suggested_score": 3,
          "max_score": 5,
          "needs_review": true,
          "illegible": false,
          "note": "justification du score"
        }
      ],
      "total_suggested": 12,
      "total_max": 20,
      "score_sur_10": 6.0
    }
  ]
}

Important: score_sur_10 = total_suggested / total_max * 10, arrondi a 1 decimale.
Si pas de nom: "Eleve inconnu (page X)".`;
    }

    // ── Construire le contenu du message Claude ───────────────────────────────
    const messageContent: Array<{ type: string; source?: object; text?: string }> = [];

    if (correctionKeyBase64) {
      messageContent.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: correctionKeyBase64 },
      });
    }

    messageContent.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
    });

    messageContent.push({ type: "text", text: prompt });

    // ── Appel Claude Vision ───────────────────────────────────────────────────
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 8192,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      throw new Error(`Anthropic error ${anthropicRes.status}: ${errBody.slice(0, 300)}`);
    }

    const anthropicData = (await anthropicRes.json()) as { content?: Array<{ type: string; text?: string }> };
    const rawText = anthropicData.content?.find(c => c.type === "text")?.text ?? "";

    // ── Parser le JSON retourne par Claude ────────────────────────────────────
    let result: CorrectionResult;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Pas de JSON dans la reponse");
      result = JSON.parse(jsonMatch[0]) as CorrectionResult;
    } catch {
      return NextResponse.json({
        error: "L'IA n'a pas retourne un JSON valide. Reessaie ou verifie que le PDF est lisible.",
        raw: rawText.slice(0, 500),
      }, { status: 422 });
    }

    // ── Calculer score_sur_10 si absent ──────────────────────────────────────
    for (const stud of result.students) {
      if (stud.score_sur_10 === undefined || stud.score_sur_10 === null) {
        const tm = stud.total_max > 0 ? stud.total_max : (totalMax > 0 ? totalMax : 20);
        stud.score_sur_10 = tm > 0 ? Math.round((stud.total_suggested / tm) * 100) / 10 : 0;
      }
    }

    // ── Sauvegarder la session de correction ──────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from("correction_sessions")
      .insert({
        assessment_id: assessmentId,
        school_id: gridRow?.school_id ?? assessment?.school_id ?? null,
        teacher_id: user.id,
        status: "reviewing",
        extractions: result.students,
      })
      .select("id")
      .single();
    if (sessionErr) console.error("[correct] insert correction_session:", sessionErr.message);
    result.session_id = session?.id ?? undefined;

    // Nettoyage Storage (fire and forget)
    const pathsToRemove = [pdfPath, ...(corrKeyPath ? [corrKeyPath] : [])];
    void supabase.storage.from("correction-uploads").remove(pathsToRemove);

    return NextResponse.json(result);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[correct]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

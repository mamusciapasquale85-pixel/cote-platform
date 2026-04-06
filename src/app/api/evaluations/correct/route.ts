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
  illegible?: boolean; // true si l'écriture est illisible → doit être vérifié par le prof
  note?: string;
};

export type StudentExtraction = {
  name: string;
  page_hint?: string;
  answers: QuestionExtraction[];
  total_suggested: number;
  total_max: number;
  score_sur_10?: number; // total_suggested / total_max * 10
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
    if (userErr || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante" }, { status: 500 });

    const form = await req.formData();
    const pdfFile        = form.get("pdf") as File | null;
    const correctionKey  = form.get("correction_key") as File | null;
    const assessmentId   = form.get("assessment_id") as string | null;

    if (!pdfFile || !assessmentId) {
      return NextResponse.json({ error: "pdf + assessment_id requis" }, { status: 400 });
    }

    // ── Charger la grille depuis la DB ────────────────────────────────────────
    const { data: gridRow } = await supabase
      .from("evaluation_grids")
      .select("questions, school_id")
      .eq("assessment_id", assessmentId)
      .maybeSingle();

    const questions: GridQuestion[] = (gridRow?.questions ?? []) as GridQuestion[];
    const hasGrid = questions.length > 0;
    // Sans grille ET sans corrigé : impossible de corriger
    if (!hasGrid && !correctionKey) {
      return NextResponse.json({ error: "Aucune grille définie. Fournis un corrigé officiel pour que l'IA puisse corriger." }, { status: 400 });
    }

    // ── Charger le titre de l'évaluation ─────────────────────────────────────
    const { data: assessment } = await supabase
      .from("assessments")
      .select("title, max_points")
      .eq("id", assessmentId)
      .maybeSingle();

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
        return NextResponse.json({ error: "PDF corrigé trop volumineux (max 32 MB)" }, { status: 413 });
      }
      correctionKeyBase64 = Buffer.from(ckBuffer).toString("base64");
    }

    // ── Construire la grille en texte pour le prompt ──────────────────────────
    const gridText = hasGrid ? questions.map(q =>
      `Q${q.num} [${q.type.toUpperCase()}] (${q.points} pt${q.points > 1 ? "s" : ""}): ${q.text}\n   → Réponse attendue: ${q.expected_answer}${q.options ? `\n   Options: ${q.options.join(" / ")}` : ""}`
    ).join("\n\n") : "";

    const totalMax = hasGrid ? questions.reduce((s, q) => s + q.points, 0) : 0;

    // ── Construire le prompt ──────────────────────────────────────────────────
    let prompt: string;
    if (hasGrid) {
      const correctionKeyNote = correctionKeyBase64
        ? `Je te fournis également le CORRIGÉ OFFICIEL (document 1). Utilise-le comme référence principale pour évaluer les réponses des élèves.`
        : `Utilise la grille de correction ci-dessous comme référence.`;

      prompt = `Tu es un assistant de correction d'évaluations scolaires en Fédération Wallonie-Bruxelles.

${correctionKeyNote}

${correctionKeyBase64 ? `Le document suivant contient les COPIES DES ÉLÈVES (document 2).` : `Le document contient les copies des élèves.`}

ÉVALUATION: "${assessment?.title ?? ""}"

GRILLE DE CORRECTION (total: ${totalMax} points):
${gridText}

INSTRUCTIONS DE CORRECTION:
1. Identifie chaque copie d'élève dans le PDF (nom généralement en haut de page ou sur une page de garde)
2. Pour chaque élève, extrait ses réponses question par question
3. Questions QCM et textes à trous: score automatique basé sur la correspondance exacte avec la réponse attendue (correct = max points, incorrect = 0, partiellement correct = points proportionnels)
4. Questions ouvertes: évalue en te basant sur les concepts-clés de la réponse attendue et du corrigé officiel. Marque needs_review: true pour que le prof valide ton évaluation.
5. ÉCRITURE ILLISIBLE: si tu ne peux PAS lire la réponse d'un élève à une question, mets illegible: true, needs_review: true, student_answer: "⚠ ILLISIBLE", suggested_score: 0, note: "Écriture illisible — à vérifier par le professeur". NE TENTE PAS d'interpréter une écriture illisible.
6. Si l'élève n'a rien écrit du tout, mets student_answer: "" et suggested_score: 0

Retourne UNIQUEMENT un JSON valide avec cette structure exacte:
{
  "students": [
    {
      "name": "NOM Prénom",
      "page_hint": "pages 1-3",
      "answers": [
        {
          "question_id": "q1",
          "student_answer": "réponse copiée telle quelle",
          "suggested_score": 1.5,
          "max_score": 2,
          "needs_review": false,
          "illegible": false,
          "note": "explication si nécessaire"
        }
      ],
      "total_suggested": 15.5,
      "total_max": ${totalMax},
      "score_sur_10": 7.75
    }
  ]
}

Important: total_suggested / total_max * 10, arrondi à 1 décimale = score_sur_10.
Si tu ne trouves pas de nom pour un élève, utilise "Élève inconnu (page X)".`;
    } else {
      // Mode sans grille : Claude extrait les questions depuis le corrigé
      prompt = `Tu es un assistant de correction d'évaluations scolaires en Fédération Wallonie-Bruxelles.

Le DOCUMENT 1 est le CORRIGÉ OFFICIEL. Le DOCUMENT 2 contient les COPIES DES ÉLÈVES.

ÉVALUATION: "${assessment?.title ?? ""}"

MODE SANS GRILLE PRÉDÉFINIE : commence par analyser le corrigé officiel pour identifier toutes les questions et leur barème (si visible). Ensuite, pour chaque copie d'élève :
1. Identifie le nom de l'élève (haut de page ou page de garde)
2. Pour chaque question identifiée dans le corrigé, évalue la réponse de l'élève
3. Attribue un score cohérent avec le barème du corrigé (ou proportionnel si barème absent)
4. Marque needs_review: true pour toutes les questions — le prof doit valider
5. ÉCRITURE ILLISIBLE: illegible: true, student_answer: "⚠ ILLISIBLE", suggested_score: 0, needs_review: true
6. Utilise question_id: "q1", "q2"... dans l'ordre d'apparition dans le corrigé

Retourne UNIQUEMENT un JSON valide:
{
  "students": [
    {
      "name": "NOM Prénom",
      "page_hint": "pages 1-3",
      "answers": [
        {
          "question_id": "q1",
          "student_answer": "réponse copiée",
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

Important: score_sur_10 = total_suggested / total_max * 10, arrondi à 1 décimale.
Si pas de nom: "Élève inconnu (page X)".`;
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

    // ── Parser le JSON retourné par Claude ────────────────────────────────────
    let result: CorrectionResult;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Pas de JSON dans la réponse");
      result = JSON.parse(jsonMatch[0]) as CorrectionResult;
    } catch {
      return NextResponse.json({
        error: "L'IA n'a pas retourné un JSON valide. Réessaie ou vérifie que le PDF est lisible.",
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
    const { data: session } = await supabase
      .from("correction_sessions")
      .insert({
        assessment_id: assessmentId,
        school_id: gridRow?.school_id ?? "",
        teacher_id: user.id,
        status: "reviewing",
        extractions: result.students,
      })
      .select("id")
      .single();

    result.session_id = session?.id ?? undefined;

    return NextResponse.json(result);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[correct]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

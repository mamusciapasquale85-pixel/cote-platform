import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PDFDocument } from "pdf-lib";

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

    // ── Charger le titre + answer_key de l'évaluation ────────────────────────
    const { data: assessment } = await supabase
      .from("assessments")
      .select("title, max_points, answer_key")
      .eq("id", assessmentId)
      .maybeSingle();

    const hasAnswerKey = assessment?.answer_key != null;

    // Sans grille, sans corrigé uploadé ET sans answer_key : impossible de corriger
    if (!hasGrid && !correctionKey && !hasAnswerKey) {
      return NextResponse.json({ error: "Aucune grille définie. Configure la clé de correction dans l'évaluation ou fournis un corrigé PDF." }, { status: 400 });
    }

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

Important: total_suggested / total_max * 10, arrondi à 1 décimale = score_sur_10.
Si tu ne trouves pas de nom pour un élève, utilise "Élève inconnu (page X)".`;
    } else if (hasAnswerKey && !correctionKey) {
      // Mode answer_key stocké dans la DB
      const answerKeyText = JSON.stringify(assessment!.answer_key, null, 2);
      const totalMaxFromKey = (() => {
        const ak = assessment!.answer_key as Record<string, { total_points?: number }>;
        return Object.values(ak).reduce((s, p) => s + (p?.total_points ?? 0), 0) || (assessment?.max_points ?? 40);
      })();
      prompt = `Tu es un assistant de correction d'évaluations scolaires en Fédération Wallonie-Bruxelles.

Le document contient les COPIES DES ÉLÈVES scannées.

ÉVALUATION: "${assessment?.title ?? ""}" (/${totalMaxFromKey} points)

CLEF DE CORRECTION (stockée en base de données):
${answerKeyText}

INSTRUCTIONS:
1. Identifie chaque élève (nom/prénom en haut de copie)
2. Pour partie1 (traductions): accepte les variantes proches si sens + structure corrects. question_id: "p1_q1" à "p1_q20"
3. Pour partie2 (QCM): correspondance exacte (A, B ou C). question_id: "p2_q1" à "p2_q20"
4. ILLISIBLE: illegible: true, student_answer: "⚠ ILLISIBLE", suggested_score: 0, needs_review: true
5. Vide/non répondu: student_answer: "", suggested_score: 0, needs_review: false

Retourne UNIQUEMENT un JSON valide:
{
  "students": [
    {
      "name": "NOM Prénom",
      "answers": [
        { "question_id": "p1_q1", "student_answer": "Ik ben moe na school", "suggested_score": 1, "max_score": 1, "needs_review": false },
        { "question_id": "p2_q1", "student_answer": "B", "suggested_score": 1, "max_score": 1, "needs_review": false }
      ],
      "total_suggested": 28,
      "total_max": ${totalMaxFromKey},
      "score_sur_10": 7.0
    }
  ]
}
Si pas de nom: "Élève inconnu (page X)".`;
    } else {
      // Mode sans grille : Claude extrait les questions depuis le corrigé PDF
      prompt = `Tu es un assistant de correction d'évaluations scolaires en Fédération Wallonie-Bruxelles.

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

    // ── Helper: appel Claude pour un chunk PDF ────────────────────────────────
    const PAGES_PER_STUDENT = 2;
    const CHUNK_THRESHOLD = 15 * 1024 * 1024; // 15 MB → split

    const callClaude = async (chunkBase64: string): Promise<StudentExtraction[]> => {
      const msgContent: Array<{ type: string; source?: object; text?: string }> = [];
      if (correctionKeyBase64) {
        msgContent.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: correctionKeyBase64 } });
      }
      msgContent.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: chunkBase64 } });
      msgContent.push({ type: "text", text: prompt });

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-opus-4-5", max_tokens: 8192, messages: [{ role: "user", content: msgContent }] }),
      });
      if (!r.ok) { const e = await r.text(); throw new Error(`Anthropic error ${r.status}: ${e.slice(0, 300)}`); }
      const d = await r.json() as { content?: Array<{ type: string; text?: string }> };
      const txt = d.content?.find(c => c.type === "text")?.text ?? "";
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) throw new Error(`Pas de JSON dans la réponse Claude (aperçu: ${txt.slice(0, 200)})`);
      const parsed = JSON.parse(m[0]) as { students?: StudentExtraction[] };
      return parsed.students ?? [];
    };

    // ── Appel(s) Claude Vision ────────────────────────────────────────────────
    let allStudents: StudentExtraction[] = [];

    if (pdfBuffer.byteLength > CHUNK_THRESHOLD) {
      // Split le PDF copies en tranches de PAGES_PER_STUDENT pages
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const totalPages = pdfDoc.getPageCount();

      for (let start = 0; start < totalPages; start += PAGES_PER_STUDENT) {
        const end = Math.min(start + PAGES_PER_STUDENT, totalPages);
        const chunkDoc = await PDFDocument.create();
        const indices = Array.from({ length: end - start }, (_, i) => start + i);
        const copied = await chunkDoc.copyPages(pdfDoc, indices);
        copied.forEach(pg => chunkDoc.addPage(pg));
        const chunkBytes = await chunkDoc.save();
        const chunkBase64 = Buffer.from(chunkBytes).toString("base64");
        const students = await callClaude(chunkBase64);
        allStudents.push(...students);
      }
    } else {
      allStudents = await callClaude(pdfBase64);
    }

    // ── Valider ───────────────────────────────────────────────────────────────
    if (allStudents.length === 0) {
      return NextResponse.json({
        error: "L'IA n'a extrait aucun élève. Vérifie que le PDF est lisible.",
      }, { status: 422 });
    }

    let result: CorrectionResult = { students: allStudents };

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

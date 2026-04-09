import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient as createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e)
    return String((e as { message: unknown }).message);
  return String(e);
}

type PartieCorrection = {
  reponses: Record<string, string>;
  corrections: Record<string, { reponse: string; correct: boolean; points: number; commentaire?: string }>;
  total: number;
};

type CorrectionData = {
  nom: string;
  prenom: string;
  partie1: PartieCorrection;
  partie2: PartieCorrection;
  score_total: number;
  score_max: number;
  pourcentage: number;
  points_faibles: string[];
};

type CorrectionResult = {
  fichier: string;
  eleve?: string;
  student_id?: string | null;
  resultat_id?: string;
  score?: number;
  score_max?: number;
  pourcentage?: number;
  remediation_declenchee?: boolean;
  erreur?: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const formData = await request.formData();
    const assessmentId = formData.get("assessment_id") as string;
    const files = formData.getAll("files") as File[];

    if (!assessmentId || files.length === 0)
      return NextResponse.json({ error: "assessment_id et fichiers requis" }, { status: 400 });

    // Récupérer l'évaluation et sa clé de correction
    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select("id, title, max_points, answer_key, school_id, academic_year_id")
      .eq("id", assessmentId)
      .single();

    if (assessmentError || !assessment)
      return NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });

    if (!assessment.answer_key)
      return NextResponse.json({ error: "Cette évaluation n'a pas de clé de correction. Ajoutez-la d'abord." }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey)
      return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante" }, { status: 500 });

    const results: CorrectionResult[] = [];

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        // Claude Vision lit et corrige la copie
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "pdfs-2024-09-25",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 3000,
            messages: [{
              role: "user",
              content: [
                {
                  type: "document",
                  source: { type: "base64", media_type: "application/pdf", data: base64 },
                },
                {
                  type: "text",
                  text: `Tu es un correcteur scolaire expert. Analyse cette copie d'élève scannée et corrige-la.

CLEF DE CORRECTION :
${JSON.stringify(assessment.answer_key, null, 2)}

RÈGLES DE CORRECTION :
- Partie 1 (traductions) : accepte les variantes proches si le sens et la structure sont corrects. Sois pédagogue.
- Partie 2 (QCM) : correction exacte uniquement (A, B ou C).
- Si une réponse est vide ou illisible : 0 point, commentaire "Non répondu" ou "Illisible".

Retourne UNIQUEMENT ce JSON (aucun texte autour) :
{
  "nom": "NOM en majuscules",
  "prenom": "Prénom",
  "partie1": {
    "reponses": { "1": "texte transcrit", "2": "...", ... },
    "corrections": {
      "1": { "reponse": "texte transcrit", "correct": true, "points": 1 },
      "2": { "reponse": "texte transcrit", "correct": false, "points": 0, "commentaire": "Attendu: Ze is ziek, ze blijft thuis" },
      ...
    },
    "total": 14
  },
  "partie2": {
    "reponses": { "1": "B", "2": "C", ... },
    "corrections": {
      "1": { "reponse": "B", "correct": true, "points": 1 },
      ...
    },
    "total": 17
  },
  "score_total": 31,
  "score_max": ${assessment.max_points ?? 40},
  "pourcentage": 77.5,
  "points_faibles": ["verbes irréguliers", "vocabulaire de la maison", "négation"]
}`,
                },
              ],
            }],
          }),
        });

        if (!response.ok) {
          results.push({ fichier: file.name, erreur: `Erreur API: ${response.status}` });
          continue;
        }

        const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
        const rawText = payload.content?.find(c => c.type === "text")?.text ?? "";

        let correctionData: CorrectionData;
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          correctionData = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        } catch {
          results.push({ fichier: file.name, erreur: "Impossible de lire la réponse de l'IA" });
          continue;
        }

        // Rechercher l'élève dans Supabase par nom
        const { data: students } = await supabase
          .from("students")
          .select("id, first_name, last_name")
          .eq("school_id", assessment.school_id)
          .ilike("last_name", `%${correctionData.nom.trim()}%`);

        let studentId: string | null = null;
        if (students && students.length > 0) {
          const match = students.find(s =>
            s.first_name?.toLowerCase().includes(correctionData.prenom?.toLowerCase()) ||
            correctionData.prenom?.toLowerCase().includes(s.first_name?.toLowerCase() ?? "")
          );
          studentId = (match ?? students[0]).id;
        }

        // Récupérer le teacher_id et academic_year_id
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        const { data: academicYear } = await supabase
          .from("academic_years")
          .select("id")
          .eq("school_id", assessment.school_id)
          .eq("is_current", true)
          .single();

        if (studentId && profile && academicYear) {
          // Sauvegarder dans resultats via upsert
          const { data: resultat, error: resultatError } = await supabase
            .from("resultats")
            .upsert({
              school_id: assessment.school_id,
              academic_year_id: academicYear.id,
              teacher_id: profile.id,
              student_id: studentId,
              assessment_id: assessmentId,
              value: correctionData.score_total,
              correction_detail: {
                partie1: correctionData.partie1,
                partie2: correctionData.partie2,
                pourcentage: correctionData.pourcentage,
              },
              points_faibles: correctionData.points_faibles,
              corrige_par_ia: true,
            }, { onConflict: "student_id,assessment_id" })
            .select("id")
            .single();

          if (resultatError) {
            results.push({ fichier: file.name, erreur: resultatError.message });
            continue;
          }

          // Déclencher remédiation si < 50%
          if (correctionData.pourcentage < 50 && correctionData.points_faibles.length > 0) {
            await supabase.from("remediations").insert({
              student_id: studentId,
              assessment_id: assessmentId,
              school_id: assessment.school_id,
              academic_year_id: academicYear.id,
              teacher_id: profile.id,
              statut: "Proposée",
              points_faibles: correctionData.points_faibles,
              score: correctionData.score_total,
              score_max: correctionData.score_max,
            }).then(() => {}); // Non bloquant
          }

          results.push({
            fichier: file.name,
            eleve: `${correctionData.prenom} ${correctionData.nom}`,
            student_id: studentId,
            resultat_id: resultat?.id,
            score: correctionData.score_total,
            score_max: correctionData.score_max,
            pourcentage: correctionData.pourcentage,
            remediation_declenchee: correctionData.pourcentage < 50,
          });
        } else {
          // Élève non trouvé — on sauvegarde quand même avec nom brut
          results.push({
            fichier: file.name,
            eleve: `${correctionData.prenom} ${correctionData.nom}`,
            student_id: null,
            score: correctionData.score_total,
            score_max: correctionData.score_max,
            pourcentage: correctionData.pourcentage,
            erreur: `Élève "${correctionData.prenom} ${correctionData.nom}" non trouvé dans la base — résultat non enregistré`,
          });
        }
      } catch (fileError) {
        results.push({ fichier: file.name, erreur: toNiceError(fileError) });
      }
    }

    return NextResponse.json({ success: true, corrections: results });
  } catch (error) {
    return NextResponse.json({ error: toNiceError(error) }, { status: 500 });
  }
}

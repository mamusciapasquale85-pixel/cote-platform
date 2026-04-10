import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { courseNameToSubject, generateExercicePropose } from "@/lib/generateExercicePropose";

export const runtime = "nodejs";
export const maxDuration = 60;

type ResultatImport = {
  prenom: string;
  nom: string;
  level: string;
  value: number | null;
  note_originale: string;
};

type ImportPayload = {
  evaluation: {
    titre: string;
    date: string | null;
    matiere: string;
    classe: string | null;
  };
  resultats: ResultatImport[];
};

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
      .select("school_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const schoolId = membership?.school_id;
    if (!schoolId) return NextResponse.json({ error: "École introuvable" }, { status: 400 });

    // Année scolaire active
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: academicYear } = await (supabase as any)
      .from("academic_years")
      .select("id")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const body = await req.json() as ImportPayload;
    const { evaluation, resultats } = body;

    if (!resultats?.length) return NextResponse.json({ error: "Aucun résultat à importer" }, { status: 400 });

    // 1. Créer l'évaluation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newAssessment, error: assessmentErr } = await (supabase as any)
      .from("assessments")
      .insert({
        school_id: schoolId,
        teacher_user_id: user.id,
        teacher_id: user.id,
        title: evaluation.titre,
        date: evaluation.date,
        matiere: evaluation.matiere,
        type: "formative",
        status: "published",
      })
      .select("id")
      .single();

    if (assessmentErr) throw assessmentErr;
    const assessmentId = newAssessment.id;

    // 2. Pour chaque résultat, trouver l'élève et insérer
    let importes = 0;
    let ignores = 0;
    const erreurs: string[] = [];

    for (const r of resultats) {
      try {
        // Chercher l'élève par prénom + nom
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: eleves } = await (supabase as any)
          .from("students")
          .select("id")
          .eq("school_id", schoolId)
          .ilike("first_name", `%${r.prenom.trim()}%`)
          .ilike("last_name", `%${r.nom.trim()}%`)
          .limit(1);

        if (!eleves?.length) {
          ignores++;
          erreurs.push(`Élève introuvable : ${r.prenom} ${r.nom}`);
          continue;
        }

        const studentId = eleves[0].id;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("resultats").insert({
          school_id: schoolId,
          academic_year_id: academicYear?.id ?? null,
          teacher_id: user.id,
          student_id: studentId,
          assessment_id: assessmentId,
          level: r.level,
          value: r.value,
        });

        // Si I ou NI → créer remédiation + générer exercice en background
        if (["I", "NI"].includes(r.level)) {
          const importSubject = courseNameToSubject(evaluation.matiere ?? "");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newRem } = await (supabase as any).from("remediations").insert({
            eleve_id: studentId,
            assessment_id: assessmentId,
            type_remediation: "Exercices",
            origine: "Import",
            statut: "Proposee",
            subject: importSubject,
            attendu: evaluation.titre, // titre de l'évaluation comme thème par défaut
          }).select("id").maybeSingle();

          // Option B : générer un exercice en background
          if (newRem?.id) {
            void generateExercicePropose({
              supabase,
              remediationId: newRem.id,
              subject: importSubject,
              attendu: evaluation.titre,
              evaluationTitre: evaluation.titre,
            });
          }
        }

        importes++;
      } catch (e) {
        erreurs.push(`Erreur pour ${r.prenom} ${r.nom} : ${toNiceError(e)}`);
        ignores++;
      }
    }

    return NextResponse.json({
      success: true,
      assessment_id: assessmentId,
      importes,
      ignores,
      erreurs: erreurs.slice(0, 10),
      message: `${importes} résultats importés, ${ignores} ignorés.`,
    });

  } catch (error) {
    return NextResponse.json({ error: toNiceError(error) }, { status: 500 });
  }
}

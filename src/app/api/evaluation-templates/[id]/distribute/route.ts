import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ─── POST : distribuer un modèle à plusieurs classes ─────────────────────────
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json() as {
    classe_ids: string[];
    date: string;
    statut: string;
    course_id?: string;
    academic_year_id?: string;
    school_id?: string;
  };

  if (!body.classe_ids?.length) return NextResponse.json({ error: "classe_ids requis" }, { status: 400 });
  if (!body.date) return NextResponse.json({ error: "date requise" }, { status: 400 });

  // Récupérer le modèle
  const { data: tpl, error: tplErr } = await supabase
    .from("evaluation_templates")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (tplErr || !tpl) return NextResponse.json({ error: "Modèle introuvable" }, { status: 404 });

  // Créer une évaluation par classe
  const assessments = body.classe_ids.map((classe_id: string) => ({
    school_id: tpl.school_id ?? body.school_id ?? null,
    academic_year_id: body.academic_year_id ?? null,
    teacher_user_id: user.id,
    title: tpl.titre,
    type: tpl.type,
    date: body.date,
    max_points: tpl.cotation_type === "points" ? (tpl.points_max ?? 20) : null,
    weight: null,
    status: body.statut ?? "draft",
    parent_visible: false,
    instructions: tpl.instructions ?? null,
    class_group_id: classe_id,
    course_id: body.course_id ?? null,
    apprentissage_id: null,
    cotation_type: tpl.cotation_type ?? "points",
    competences_evaluees: [],
    fichier_path: tpl.fichier_path ?? null,
    fichier_nom: tpl.fichier_nom ?? null,
    template_id: tpl.id,
  }));

  const { data: created, error: insertErr } = await supabase
    .from("assessments")
    .insert(assessments)
    .select("id");

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Copier la grille si elle existe
  if (tpl.grille && Array.isArray(tpl.grille) && tpl.grille.length > 0 && created?.length) {
    const grilles = created.map((a: { id: string }) => ({
      assessment_id: a.id,
      school_id: tpl.school_id ?? body.school_id ?? null,
      questions: tpl.grille,
      updated_at: new Date().toISOString(),
    }));
    await supabase.from("evaluation_grids").insert(grilles);
  }

  return NextResponse.json({ ok: true, count: created?.length ?? 0 });
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Mapping subject IDs → possible course name patterns (for ilike search)
const SUBJECT_COURSE_NAMES: Record<string, string[]> = {
  nl:              ["néerlandais", "neerlandais", "neerl%", "dutch%"],
  en:              ["anglais", "english%", "angl%"],
  mathematiques:   ["math%", "mathématiques", "mathematiques"],
  sciences:        ["sciences%", "biologie%", "chimie%", "physique%", "sc.%"],
  histoire:        ["histoire%", "hist%"],
  geographie:      ["géographie%", "geographie%", "géo%", "geo%"],
  francais:        ["français%", "francais%", "fr.%"],
  langues_modernes:["langues%", "lm%"],
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = await req.json() as {
    classesWithDates: { classe_id: string; date: string }[];
    statut: string;
    course_id?: string;
    school_id?: string;
  };

  if (!body.classesWithDates?.length) return NextResponse.json({ error: "classesWithDates requis" }, { status: 400 });
  if (body.classesWithDates.some(x => !x.date)) return NextResponse.json({ error: "date requise pour chaque classe" }, { status: 400 });

  const { data: tpl, error: tplErr } = await supabase
    .from("evaluation_templates")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (tplErr || !tpl) return NextResponse.json({ error: "Modele introuvable" }, { status: 404 });

  // Resoudre course_id depuis la matiere du modele
  let courseId: string | null = body.course_id ?? null;
  if (!courseId && tpl.matiere) {
    const schoolId = tpl.school_id ?? body.school_id ?? null;
    // Keywords to match against course names (case-insensitive substring match)
    const keywords = [
      tpl.matiere.toLowerCase(),
      ...(SUBJECT_COURSE_NAMES[tpl.matiere] ?? []).map(p => p.replace(/%/g, "").toLowerCase()),
    ];

    // Fetch all courses (scoped to school if possible)
    let q = supabase.from("courses").select("id, name");
    if (schoolId) q = (q as typeof q).eq("school_id", schoolId);
    const { data: allCourses } = await q.limit(50);

    if (allCourses?.length) {
      // Try exact substring match first
      for (const kw of keywords) {
        if (courseId) break;
        const match = allCourses.find(c => c.name.toLowerCase().includes(kw));
        if (match) courseId = match.id;
      }
    }

    // Fallback: fetch all courses without school filter
    if (!courseId) {
      const { data: globalCourses } = await supabase
        .from("courses").select("id, name").limit(100);
      if (globalCourses?.length) {
        for (const kw of keywords) {
          if (courseId) break;
          const match = globalCourses.find(c => c.name.toLowerCase().includes(kw));
          if (match) courseId = match.id;
        }
      }
    }
  }

  // If course_id still not found, proceed without it (nullable field)
  // The insert will fail at DB level if truly required

  const assessments = body.classesWithDates.map(({ classe_id, date }) => ({
    school_id: tpl.school_id ?? body.school_id ?? null,
    teacher_user_id: user.id,
    title: tpl.titre,
    type: tpl.type,
    date,
    max_points: tpl.cotation_type === "points" ? (tpl.points_max ?? 20) : null,
    weight: null,
    status: body.statut ?? "draft",
    parent_visible: false,
    instructions: tpl.instructions ?? null,
    class_group_id: classe_id,
    course_id: courseId,
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

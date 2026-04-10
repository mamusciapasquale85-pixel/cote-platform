import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(_req: NextRequest) {
  try {
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

    // Récupérer l'école de l'utilisateur
    const { data: mem, error: memErr } = await supabase
      .from("school_memberships")
      .select("school_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (memErr) throw memErr;
    if (!mem?.school_id) {
      return NextResponse.json({ error: "Aucun établissement trouvé." }, { status: 400 });
    }

    const schoolId = mem.school_id;

    // Récupérer les remédiations avec joins
    const { data: remediations, error: remErr } = await supabase
      .from("remediations")
      .select(`
        id,
        subject,
        niveau,
        exercice_propose,
        eleve_id,
        classe_id,
        assessment_id,
        attendu,
        type_remediation,
        origine,
        statut,
        created_at,
        students ( first_name, last_name ),
        class_groups ( name ),
        assessments ( title ),
        seances_remediation (
          date_seance,
          duree_minutes,
          notes
        )
      `)
      .eq("classe_id", schoolId) // filtre via classe liée à l'école
      .order("created_at", { ascending: false });

    // Si aucun résultat avec filtre école, on charge tout ce que l'utilisateur peut voir (RLS)
    const { data: allRemediations, error: allRemErr } = await supabase
      .from("remediations")
      .select(`
        id,
        subject,
        niveau,
        exercice_propose,
        eleve_id,
        classe_id,
        assessment_id,
        attendu,
        type_remediation,
        origine,
        statut,
        created_at,
        students ( first_name, last_name ),
        class_groups ( name ),
        assessments ( title ),
        seances_remediation (
          date_seance,
          duree_minutes,
          notes
        )
      `)
      .order("created_at", { ascending: false });

    if (allRemErr) throw allRemErr;

    const items = (allRemediations ?? []).map((r: any) => {
      const seance = Array.isArray(r.seances_remediation)
        ? r.seances_remediation[0] ?? null
        : r.seances_remediation ?? null;

      const student = Array.isArray(r.students) ? r.students[0] : r.students;
      const classe = Array.isArray(r.class_groups) ? r.class_groups[0] : r.class_groups;
      const assessment = Array.isArray(r.assessments) ? r.assessments[0] : r.assessments;

      return {
        id: r.id,
        subject: r.subject ?? null,
        niveau: r.niveau ?? null,
        exercice_propose: r.exercice_propose ?? null,
        eleve_id: r.eleve_id,
        classe_id: r.classe_id,
        assessment_id: r.assessment_id,
        statut: r.statut ?? "Proposee",
        type_remediation: r.type_remediation,
        attendu: r.attendu,
        origine: r.origine,
        created_at: r.created_at,
        eleve_nom: student
          ? `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim()
          : "Élève inconnu",
        classe_nom: classe?.name ?? "Classe inconnue",
        evaluation_titre: assessment?.title ?? "—",
        date_seance: seance?.date_seance ?? null,
        duree_minutes: seance?.duree_minutes ?? null,
        seance_notes: seance?.notes ?? null,
      };
    });

    return NextResponse.json({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

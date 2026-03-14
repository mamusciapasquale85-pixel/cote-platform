import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function toErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as any).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const teacherId = userData.user.id;

    const { data: mem } = await supabase
      .from("school_memberships").select("school_id").eq("user_id", teacherId).limit(1).maybeSingle();
    if (!mem?.school_id) throw new Error("École introuvable");
    const schoolId = mem.school_id;

    const { data: ay } = await supabase
      .from("academic_years").select("id").eq("school_id", schoolId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ay?.id) throw new Error("Année scolaire introuvable");
    const academicYearId = ay.id;

    // Stats counts
    const [
      { count: nbEleves },
      { count: nbClasses },
      { count: remActives },
      { count: remTerminees },
      { count: nbEvals },
      { count: nbNI },
    ] = await Promise.all([
      supabase.from("students").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("class_groups").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("academic_year_id", academicYearId),
      supabase.from("remediations").select("id", { count: "exact", head: true }).in("statut", ["Proposee", "En cours"]),
      supabase.from("remediations").select("id", { count: "exact", head: true }).eq("statut", "Terminee"),
      supabase.from("assessments").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("resultats").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("level", "NI"),
    ]);

    // Élèves en difficulté (ceux avec le plus de NI)
    const { data: niRows } = await supabase
      .from("resultats")
      .select("student_id, students(id, first_name, last_name)")
      .eq("school_id", schoolId)
      .eq("academic_year_id", academicYearId)
      .eq("level", "NI")
      .limit(100);

    const counter = new Map<string, { id: string; prenom: string; nom: string; nb_ni: number }>();
    for (const row of (niRows ?? []) as any[]) {
      const s = toOne((row as any).students);
      if (!s?.id) continue;
      const cur = counter.get(s.id) ?? { id: s.id, prenom: s.first_name ?? "", nom: s.last_name ?? "", nb_ni: 0 };
      cur.nb_ni += 1;
      counter.set(s.id, cur);
    }
    const elevesEnDifficulte = Array.from(counter.values())
      .sort((a, b) => b.nb_ni - a.nb_ni)
      .slice(0, 6);

    // Remédiations récentes
    const { data: remRows } = await supabase
      .from("remediations")
      .select("id,statut,attendu,type_remediation,created_at,eleve_id,students(first_name,last_name)")
      .in("statut", ["Proposee", "En cours"])
      .order("created_at", { ascending: false })
      .limit(6);

    const remRecentes = (remRows ?? []).map((r: any) => {
      const s = toOne((r as any).students);
      return {
        id: r.id, statut: r.statut, attendu: r.attendu,
        type_remediation: r.type_remediation, created_at: r.created_at,
        eleve_id: r.eleve_id,
        eleve_nom: s ? `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() : "—",
      };
    });

    // Évaluations récentes
    const { data: evalRows } = await supabase
      .from("assessments")
      .select("id,title,date,type")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(5);

    const rt = remTerminees ?? 0;
    const ra = remActives ?? 0;

    return NextResponse.json({
      stats: {
        nb_eleves: nbEleves ?? 0,
        nb_classes: nbClasses ?? 0,
        rem_actives: ra,
        rem_terminees: rt,
        nb_evals: nbEvals ?? 0,
        nb_ni: nbNI ?? 0,
        taux_remediation: rt + ra > 0 ? Math.round((rt / (rt + ra)) * 100) : 0,
      },
      eleves_en_difficulte: elevesEnDifficulte,
      rem_recentes: remRecentes,
      evals_recentes: (evalRows ?? []).map((e: any) => ({
        id: e.id, title: e.title, date: e.date, type: e.type,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: toErr(e) }, { status: 500 });
  }
}

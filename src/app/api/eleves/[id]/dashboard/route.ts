import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type UUID = string;
type ApiStatut = "Proposee" | "En cours" | "Terminee";
type SeanceStatut = "Planifiee" | "Realisee" | "Annulee";

type DashboardPayload = {
  eleve: {
    id: string;
    prenom: string;
    nom: string;
    classe_nom: string;
    classe_id: string;
  };
  score_maitrise: number;
  lacunes: Array<{
    id: string;
    evaluation_titre: string;
    attendu: string | null;
    date: string | null;
    value: number | null;
  }>;
  remediations: Array<{
    id: string;
    statut: ApiStatut;
    attendu: string | null;
    type_remediation: string | null;
    evaluation_titre: string | null;
    created_at: string;
  }>;
  seances: Array<{
    id: string;
    date_seance: string | null;
    duree_minutes: number | null;
    statut: SeanceStatut;
    notes: string | null;
    attendu: string | null;
  }>;
  progression: Array<{
    node_id: string;
    node_titre: string;
    nb_evaluations: number;
    nb_reussis: number;
    taux: number;
  }>;
  historique: Array<{
    id: string;
    evaluation_titre: string;
    date: string | null;
    value: number | null;
    level: string | null;
  }>;
};

type Scope = {
  schoolId: UUID;
  academicYearId: UUID;
  teacherId: UUID;
};

function toErrorMessage(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message) return error.message;
    if ("error_description" in error && typeof error.error_description === "string" && error.error_description) {
      return error.error_description;
    }
  }
  try { return JSON.stringify(error); } catch { return String(error); }
}

function normalizeText(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function toApiStatut(value: string | null | undefined): ApiStatut {
  if (!value) return "Proposee";
  const n = normalizeText(value).replace(/\s+/g, " ");
  if (n === "proposee" || n === "propose") return "Proposee";
  if (n === "en cours" || n === "encours") return "En cours";
  if (n === "terminee" || n === "termine") return "Terminee";
  return "Proposee";
}

function toSeanceStatut(value: string | null | undefined): SeanceStatut {
  if (!value) return "Planifiee";
  const n = normalizeText(value).replace(/\s+/g, " ");
  if (n === "realisee" || n === "realise") return "Realisee";
  if (n === "annulee" || n === "annule") return "Annulee";
  return "Planifiee";
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isMissingTable(error: unknown, tableName: string): boolean {
  const msg = toErrorMessage(error).toLowerCase();
  return msg.includes(tableName.toLowerCase()) &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find the table"));
}

function isMissingColumn(error: unknown, columnName: string): boolean {
  const msg = toErrorMessage(error).toLowerCase();
  return msg.includes(columnName.toLowerCase()) && (msg.includes("does not exist") || msg.includes("schema cache"));
}

function isNi(level: string | null | undefined): boolean {
  return normalizeText(level ?? "") === "ni";
}

async function getScope(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<Scope> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userData.user) throw new Error("Non authentifié");
  const teacherId = userData.user.id as UUID;

  const { data: membership, error: membershipErr } = await supabase
    .from("school_memberships").select("school_id").eq("user_id", teacherId).limit(1).maybeSingle();
  if (membershipErr) throw membershipErr;
  if (!membership?.school_id) throw new Error("Aucune école trouvée pour cet utilisateur.");
  const schoolId = membership.school_id as UUID;

  const { data: academicYear, error: academicYearErr } = await supabase
    .from("academic_years").select("id").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (academicYearErr) throw academicYearErr;
  if (!academicYear?.id) throw new Error("Aucune année scolaire active trouvée.");

  return { schoolId, academicYearId: academicYear.id as UUID, teacherId };
}

async function getClassInfo(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  scope: Scope, eleveId: UUID
): Promise<{ classe_id: string; classe_nom: string }> {
  const enrollmentRes = await supabase
    .from("student_enrollments").select("class_group_id,class_groups(id,name)")
    .eq("school_id", scope.schoolId).eq("academic_year_id", scope.academicYearId)
    .eq("student_id", eleveId).limit(1).maybeSingle();
  if (enrollmentRes.error) throw enrollmentRes.error;
  const classJoined = toOne((enrollmentRes.data as any)?.class_groups as any);
  const classId = ((enrollmentRes.data as any)?.class_group_id ?? classJoined?.id ?? "") as string;
  const className = (classJoined?.name ?? "") as string;
  return { classe_id: classId, classe_nom: className };
}

async function fetchCurriculumNodeTitles(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  nodeIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (nodeIds.length === 0) return map;

  const tryTitle = await supabase.from("curriculum_nodes").select("id,title").in("id", nodeIds);
  if (!tryTitle.error) {
    for (const row of (tryTitle.data ?? []) as Array<{ id: string; title: string | null }>) {
      map.set(row.id, row.title?.trim() || "Compétence");
    }
    return map;
  }
  if (isMissingTable(tryTitle.error, "curriculum_nodes")) return map;
  if (!isMissingColumn(tryTitle.error, "title")) throw tryTitle.error;

  const tryName = await supabase.from("curriculum_nodes").select("id,name").in("id", nodeIds);
  if (!tryName.error) {
    for (const row of (tryName.data ?? []) as Array<{ id: string; name: string | null }>) {
      map.set(row.id, row.name?.trim() || "Compétence");
    }
    return map;
  }
  if (isMissingTable(tryName.error, "curriculum_nodes")) return map;
  if (!isMissingColumn(tryName.error, "name")) throw tryName.error;

  const tryIdOnly = await supabase.from("curriculum_nodes").select("id").in("id", nodeIds);
  if (tryIdOnly.error) {
    if (isMissingTable(tryIdOnly.error, "curriculum_nodes")) return map;
    throw tryIdOnly.error;
  }
  for (const row of (tryIdOnly.data ?? []) as Array<{ id: string }>) map.set(row.id, "Compétence");
  return map;
}

async function fetchSeances(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eleveId: UUID
): Promise<DashboardPayload["seances"]> {
  try {
    // Cherche les séances où cet élève est inscrit
    const res = await supabase
      .from("seance_eleves")
      .select("seance_id,seances_remediation(id,date_seance,duree_minutes,statut,notes,remediations(attendu))")
      .eq("eleve_id", eleveId)
      .order("seance_id", { ascending: false })
      .limit(10);

    if (res.error) {
      // Table absente → on retourne vide silencieusement
      if (isMissingTable(res.error, "seance_eleves") || isMissingTable(res.error, "seances_remediation")) return [];
      throw res.error;
    }

    return ((res.data ?? []) as any[]).map((row: any) => {
      const s = toOne(row.seances_remediation);
      if (!s) return null;
      const rem = toOne((s as any).remediations);
      return {
        id: (s as any).id,
        date_seance: (s as any).date_seance ?? null,
        duree_minutes: toNumber((s as any).duree_minutes),
        statut: toSeanceStatut((s as any).statut),
        notes: (s as any).notes ?? null,
        attendu: (rem as any)?.attendu ?? null,
      };
    }).filter(Boolean) as DashboardPayload["seances"];
  } catch {
    return [];
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const scope = await getScope(supabase);
    const { id } = await params;
    const eleveId = id?.trim() as UUID;
    if (!eleveId) return NextResponse.json({ error: "Identifiant élève manquant" }, { status: 400 });

    const studentRes = await supabase.from("students").select("id,first_name,last_name")
      .eq("school_id", scope.schoolId).eq("id", eleveId).maybeSingle();
    if (studentRes.error) throw studentRes.error;
    if (!studentRes.data) return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });

    const classInfo = await getClassInfo(supabase, scope, eleveId);

    const anyClient = supabase as any;

    const runResultatsQuery = async (withCurriculumNode: boolean) => {
      return anyClient.from("resultats")
        .select(withCurriculumNode
          ? "id,level,value,created_at,assessment_id,assessments(id,title,date,curriculum_node_id)"
          : "id,level,value,created_at,assessment_id,assessments(id,title,date)")
        .eq("school_id", scope.schoolId).eq("academic_year_id", scope.academicYearId)
        .eq("student_id", eleveId).order("created_at", { ascending: false });
    };

    let resultatsRes = await runResultatsQuery(true);
    let hasCurriculumNode = true;
    if (resultatsRes.error && isMissingColumn(resultatsRes.error, "curriculum_node_id")) {
      hasCurriculumNode = false;
      resultatsRes = await runResultatsQuery(false);
    }
    if (resultatsRes.error) throw resultatsRes.error;

    const runRemediationsQuery = async (withAssessmentId: boolean) => {
      return anyClient.from("remediations")
        .select(withAssessmentId
          ? "id,statut,attendu,type_remediation,created_at,assessment_id,assessments(title)"
          : "id,statut,attendu,type_remediation,created_at")
        .eq("eleve_id", eleveId).order("created_at", { ascending: false });
    };

    let remediationsRes = await runRemediationsQuery(true);
    if (remediationsRes.error && isMissingColumn(remediationsRes.error, "assessment_id")) {
      remediationsRes = await runRemediationsQuery(false);
    }
    if (remediationsRes.error) throw remediationsRes.error;

    const resultRows = (resultatsRes.data ?? []) as any[];
    const remediationRows = (remediationsRes.data ?? []) as any[];

    const nodeIds = hasCurriculumNode
      ? Array.from(new Set(resultRows.map((row) => toOne(row.assessments)?.curriculum_node_id ?? null).filter(Boolean) as string[]))
      : [];

    const nodeTitles = hasCurriculumNode
      ? await fetchCurriculumNodeTitles(supabase, nodeIds)
      : new Map<string, string>();

    const historique = resultRows.map((row) => {
      const assessment = toOne(row.assessments);
      return {
        id: row.id,
        evaluation_titre: assessment?.title?.trim() || "Évaluation",
        date: assessment?.date ?? null,
        value: toNumber(row.value),
        level: row.level,
      };
    });

    const totalEvaluations = historique.length;
    const reussies = historique.filter((row) => !isNi(row.level)).length;
    const scoreMaitrise = totalEvaluations > 0 ? Math.round((reussies / totalEvaluations) * 100) : 0;

    const lacunes = resultRows.filter((row) => isNi(row.level)).map((row) => {
      const assessment = toOne(row.assessments);
      const nodeId = hasCurriculumNode ? (assessment?.curriculum_node_id ?? null) : null;
      return {
        id: row.id,
        evaluation_titre: assessment?.title?.trim() || "Évaluation",
        attendu: nodeId ? nodeTitles.get(nodeId) ?? null : null,
        date: assessment?.date ?? null,
        value: toNumber(row.value),
      };
    });

    const remediations = remediationRows.map((row) => {
      const assessment = toOne(row.assessments);
      return {
        id: row.id,
        statut: toApiStatut(row.statut),
        attendu: row.attendu ?? null,
        type_remediation: row.type_remediation ?? null,
        evaluation_titre: assessment?.title?.trim() || null,
        created_at: row.created_at ?? new Date(0).toISOString(),
      };
    });

    const seances = await fetchSeances(supabase, eleveId);

    let progression: DashboardPayload["progression"] = [];
    if (hasCurriculumNode) {
      const progressMap = new Map<string, { node_titre: string; nb_evaluations: number; nb_reussis: number }>();
      for (const row of resultRows) {
        const assessment = toOne(row.assessments);
        const nodeId = assessment?.curriculum_node_id;
        if (!nodeId) continue;
        const current = progressMap.get(nodeId) ?? { node_titre: nodeTitles.get(nodeId) ?? "Compétence", nb_evaluations: 0, nb_reussis: 0 };
        current.nb_evaluations += 1;
        if (!isNi(row.level)) current.nb_reussis += 1;
        progressMap.set(nodeId, current);
      }
      progression = Array.from(progressMap.entries()).map(([nodeId, values]) => ({
        node_id: nodeId,
        node_titre: values.node_titre,
        nb_evaluations: values.nb_evaluations,
        nb_reussis: values.nb_reussis,
        taux: values.nb_evaluations > 0 ? Math.round((values.nb_reussis / values.nb_evaluations) * 1000) / 10 : 0,
      })).sort((a, b) => a.node_titre.localeCompare(b.node_titre, "fr", { sensitivity: "base" }));
    }

    const payload: DashboardPayload = {
      eleve: {
        id: studentRes.data.id,
        prenom: studentRes.data.first_name ?? "",
        nom: studentRes.data.last_name ?? "",
        classe_nom: classInfo.classe_nom || "Classe inconnue",
        classe_id: classInfo.classe_id || "",
      },
      score_maitrise: scoreMaitrise,
      lacunes,
      remediations,
      seances,
      progression,
      historique,
    };

    return NextResponse.json(payload);
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

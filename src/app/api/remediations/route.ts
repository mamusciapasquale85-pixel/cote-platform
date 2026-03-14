import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type UUID = string;
type ApiStatut = "Proposee" | "En cours" | "Terminee";

type RemediationBaseRow = {
  id: UUID;
  eleve_id: UUID | null;
  classe_id: UUID | null;
  assessment_id?: UUID | null;
  attendu: string | null;
  type_remediation: string | null;
  origine: string | null;
  statut: string | null;
  created_at: string | null;
};

type SeanceRow = {
  remediation_id: UUID;
  date_seance: string | null;
  duree_minutes: number | null;
  notes: string | null;
};

const ALLOWED_STATUSES: ApiStatut[] = ["Proposee", "En cours", "Terminee"];

function toErrorMessage(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message) return error.message;
    if ("error_description" in error && typeof error.error_description === "string" && error.error_description) {
      return error.error_description;
    }
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toApiStatut(value: string | null | undefined): ApiStatut | null {
  if (!value) return null;
  const normalized = normalizeText(value).replace(/\s+/g, " ");
  if (normalized === "proposee" || normalized === "propose") return "Proposee";
  if (normalized === "en cours" || normalized === "encours") return "En cours";
  if (normalized === "terminee" || normalized === "termine") return "Terminee";
  return null;
}

function isMissingTableError(error: unknown, tableName: string): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return (
    message.includes("does not exist") && message.includes(tableName.toLowerCase())
  ) || (
    message.includes("could not find the table") && message.includes(tableName.toLowerCase())
  ) || (
    message.includes("schema cache") && message.includes(tableName.toLowerCase())
  );
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return message.includes("does not exist") && message.includes(columnName.toLowerCase());
}

function uniqIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function updateRemediationStatus(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  remediationId: string,
  statut: ApiStatut
) {
  const { data, error } = await supabase
    .from("remediations")
    .update({ statut })
    .eq("id", remediationId)
    .select("id,statut")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return null;
  }

  return data;
}

async function readRemediations(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  options: { classeId?: string | null; statut?: ApiStatut | null }
): Promise<Array<RemediationBaseRow & { assessment_id: string | null }>> {
  const runQuery = async (withAssessment: boolean) => {
    const anyClient = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => any;
          order: (column: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };

    let query = anyClient
      .from("remediations")
      .select(
        withAssessment
          ? "id,eleve_id,classe_id,assessment_id,attendu,type_remediation,origine,statut,created_at"
          : "id,eleve_id,classe_id,attendu,type_remediation,origine,statut,created_at"
      );

    if (options.classeId) {
      query = query.eq("classe_id", options.classeId);
    }
    if (options.statut) {
      query = query.eq("statut", options.statut);
    }

    return query.order("created_at", { ascending: false });
  };

  const withAssessment = await runQuery(true);
  if (!withAssessment.error) {
    return (withAssessment.data ?? []) as Array<RemediationBaseRow & { assessment_id: string | null }>;
  }

  if (!isMissingColumnError(withAssessment.error, "assessment_id")) {
    throw withAssessment.error;
  }

  const withoutAssessment = await runQuery(false);
  if (withoutAssessment.error) {
    throw withoutAssessment.error;
  }

  return ((withoutAssessment.data ?? []) as RemediationBaseRow[]).map((row) => ({
    ...row,
    assessment_id: null,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const url = new URL(req.url);
    const classeId = url.searchParams.get("classe_id");
    const statutParam = url.searchParams.get("statut");
    const statut = toApiStatut(statutParam);

    if (statutParam && !statut) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const remediations = await readRemediations(supabase, {
      classeId,
      statut,
    });

    const eleveIds = uniqIds(remediations.map((row) => row.eleve_id));
    const classeIds = uniqIds(remediations.map((row) => row.classe_id));
    const assessmentIds = uniqIds(remediations.map((row) => row.assessment_id));
    const remediationIds = uniqIds(remediations.map((row) => row.id));

    const [studentsRes, classesRes, assessmentsRes] = await Promise.all([
      eleveIds.length
        ? supabase.from("students").select("id,first_name,last_name").in("id", eleveIds)
        : Promise.resolve({ data: [], error: null }),
      classeIds.length
        ? supabase.from("class_groups").select("id,name").in("id", classeIds)
        : Promise.resolve({ data: [], error: null }),
      assessmentIds.length
        ? supabase.from("assessments").select("id,title").in("id", assessmentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (studentsRes.error) throw studentsRes.error;
    if (classesRes.error) throw classesRes.error;
    if (assessmentsRes.error) throw assessmentsRes.error;

    let seances: SeanceRow[] = [];
    if (remediationIds.length > 0) {
      const seancesRes = await supabase
        .from("seances_remediation")
        .select("remediation_id,date_seance,duree_minutes,notes")
        .in("remediation_id", remediationIds)
        .order("date_seance", { ascending: false });

      if (seancesRes.error) {
        if (!isMissingTableError(seancesRes.error, "seances_remediation")) {
          throw seancesRes.error;
        }
        // TODO: créer table seances_remediation
      } else {
        seances = (seancesRes.data ?? []) as SeanceRow[];
      }
    }

    const studentsMap = new Map<string, string>(
      ((studentsRes.data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>).map((student) => [
        student.id,
        [student.first_name, student.last_name].filter(Boolean).join(" ").trim() || "Élève inconnu",
      ])
    );

    const classesMap = new Map<string, string>(
      ((classesRes.data ?? []) as Array<{ id: string; name: string | null }>).map((classGroup) => [
        classGroup.id,
        classGroup.name?.trim() || "Classe inconnue",
      ])
    );

    const assessmentsMap = new Map<string, string>(
      ((assessmentsRes.data ?? []) as Array<{ id: string; title: string | null }>).map((assessment) => [
        assessment.id,
        assessment.title?.trim() || "Évaluation inconnue",
      ])
    );

    const seancesMap = new Map<string, SeanceRow>();
    for (const seance of seances) {
      if (!seancesMap.has(seance.remediation_id)) {
        seancesMap.set(seance.remediation_id, seance);
      }
    }

    const items = remediations.map((row) => {
      const normalizedStatut = toApiStatut(row.statut) ?? "Proposee";
      const seance = seancesMap.get(row.id);

      return {
        id: row.id,
        eleve_id: row.eleve_id,
        classe_id: row.classe_id,
        assessment_id: row.assessment_id,
        statut: normalizedStatut,
        type_remediation: row.type_remediation,
        attendu: row.attendu,
        origine: row.origine,
        created_at: row.created_at,
        eleve_nom: row.eleve_id ? studentsMap.get(row.eleve_id) ?? "Élève inconnu" : "Élève inconnu",
        classe_nom: row.classe_id ? classesMap.get(row.classe_id) ?? "Classe inconnue" : "Classe inconnue",
        evaluation_titre: row.assessment_id ? assessmentsMap.get(row.assessment_id) ?? "—" : "—",
        date_seance: seance?.date_seance ?? null,
        duree_minutes: seance?.duree_minutes ?? null,
        seance_notes: seance?.notes ?? null,
      };
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = (await req.json()) as { id?: string; statut?: string };
    const remediationId = body.id?.trim() ?? "";
    const statut = toApiStatut(body.statut);

    if (!remediationId) {
      return NextResponse.json({ error: "Identifiant de remédiation manquant" }, { status: 400 });
    }
    if (!statut || !ALLOWED_STATUSES.includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const updated = await updateRemediationStatus(supabase, remediationId, statut);
    if (!updated) {
      return NextResponse.json({ error: "Remédiation introuvable" }, { status: 404 });
    }

    return NextResponse.json({ item: updated });
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

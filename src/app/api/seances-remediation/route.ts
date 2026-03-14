import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type UUID = string;
type SeanceStatut = "Planifiee" | "Realisee" | "Annulee";

const ALLOWED_STATUTS: SeanceStatut[] = ["Planifiee", "Realisee", "Annulee"];

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

function toDbStatut(value: unknown): SeanceStatut {
  const normalized = normalizeText(typeof value === "string" ? value : "").replace(/\s+/g, " ");
  if (normalized === "planifiee" || normalized === "planifie") return "Planifiee";
  if (normalized === "realisee" || normalized === "realise") return "Realisee";
  if (normalized === "annulee" || normalized === "annule") return "Annulee";
  return "Planifiee";
}

function isIsoDateTime(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function toInt(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function uniqIds(values: unknown[]): string[] {
  const normalized = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
}

function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isMissingColumn(error: unknown, column: string): boolean {
  const msg = toErrorMessage(error).toLowerCase();
  return msg.includes(column.toLowerCase()) && (msg.includes("does not exist") || msg.includes("schema cache"));
}

function isMissingTable(error: unknown, table: string): boolean {
  const msg = toErrorMessage(error).toLowerCase();
  return msg.includes(table.toLowerCase()) && (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find the table"));
}

type Scope = {
  schoolId: UUID;
  academicYearId: UUID;
  teacherId: UUID;
};

async function getScope(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<Scope> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userData.user) throw new Error("Non authentifié");

  const teacherId = userData.user.id as UUID;

  const { data: membership, error: membershipErr } = await supabase
    .from("school_memberships")
    .select("school_id")
    .eq("user_id", teacherId)
    .limit(1)
    .maybeSingle();

  if (membershipErr) throw membershipErr;
  if (!membership?.school_id) throw new Error("Aucune école trouvée pour cet utilisateur.");

  const schoolId = membership.school_id as UUID;

  const { data: academicYear, error: academicYearErr } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (academicYearErr) throw academicYearErr;
  if (!academicYear?.id) throw new Error("Aucune année scolaire active trouvée.");

  return {
    schoolId,
    academicYearId: academicYear.id as UUID,
    teacherId,
  };
}

async function getPlanningContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  scope: Scope,
  remediationId: UUID
) {
  const remRes = await supabase
    .from("remediations")
    .select("id,attendu,classe_id,eleve_id")
    .eq("id", remediationId)
    .maybeSingle();

  if (remRes.error) throw remRes.error;
  if (!remRes.data) {
    return { remediation: null, students: [] as Array<{ id: string; first_name: string; last_name: string }> };
  }

  const remediation = {
    id: remRes.data.id as string,
    attendu: (remRes.data as any).attendu as string | null,
    classe_id: (remRes.data as any).classe_id as string | null,
    eleve_id: (remRes.data as any).eleve_id as string | null,
  };

  if (!remediation.classe_id) {
    if (!remediation.eleve_id) {
      return { remediation, students: [] as Array<{ id: string; first_name: string; last_name: string }> };
    }

    const singleStudent = await supabase
      .from("students")
      .select("id,first_name,last_name")
      .eq("id", remediation.eleve_id)
      .limit(1);

    if (singleStudent.error) throw singleStudent.error;

    return {
      remediation,
      students: (singleStudent.data ?? []) as Array<{ id: string; first_name: string; last_name: string }>,
    };
  }

  let enrollmentRes = await supabase
    .from("student_enrollments")
    .select("student_id,students(id,first_name,last_name)")
    .eq("school_id", scope.schoolId)
    .eq("academic_year_id", scope.academicYearId)
    .eq("class_group_id", remediation.classe_id)
    .order("student_id", { ascending: true });

  if (enrollmentRes.error && isMissingColumn(enrollmentRes.error, "academic_year_id")) {
    enrollmentRes = await supabase
      .from("student_enrollments")
      .select("student_id,students(id,first_name,last_name)")
      .eq("school_id", scope.schoolId)
      .eq("class_group_id", remediation.classe_id)
      .order("student_id", { ascending: true });
  }

  if (enrollmentRes.error) throw enrollmentRes.error;

  const students = (enrollmentRes.data ?? [])
    .map((row: any) => {
      const joined = toOne(row.students as any) as any;
      if (!joined?.id) return null;
      return {
        id: joined.id as string,
        first_name: String(joined.first_name ?? ""),
        last_name: String(joined.last_name ?? ""),
      };
    })
    .filter(Boolean) as Array<{ id: string; first_name: string; last_name: string }>;

  students.sort((a, b) => {
    const last = a.last_name.localeCompare(b.last_name, "fr", { sensitivity: "base" });
    if (last !== 0) return last;
    return a.first_name.localeCompare(b.first_name, "fr", { sensitivity: "base" });
  });

  return { remediation, students };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const scope = await getScope(supabase);
    const anyClient = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          order: (
            column: string,
            opts: { ascending: boolean }
          ) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };

    const url = new URL(req.url);
    const remediationId = url.searchParams.get("remediation_id")?.trim() || "";
    const askContext = url.searchParams.get("context") === "1";

    if (askContext && remediationId) {
      const context = await getPlanningContext(supabase, scope, remediationId as UUID);
      return NextResponse.json(context);
    }

    let query = anyClient
      .from("seances_remediation")
      .select(
        "id,date_seance,duree_minutes,statut,notes,created_at,remediation_id,remediations(id,attendu,type_remediation,classe_id,assessment_id,assessments(title)),seance_eleves(eleve_id,students(first_name,last_name))"
      )
      .order("date_seance", { ascending: true });

    let queryResult = await query;

    if (queryResult.error && isMissingColumn(queryResult.error, "assessment_id")) {
      queryResult = await anyClient
        .from("seances_remediation")
        .select(
          "id,date_seance,duree_minutes,statut,notes,created_at,remediation_id,remediations(id,attendu,type_remediation,classe_id),seance_eleves(eleve_id,students(first_name,last_name))"
        )
        .order("date_seance", { ascending: true });
    }

    if (queryResult.error) {
      if (isMissingTable(queryResult.error, "seances_remediation")) {
        return NextResponse.json({ items: [] });
      }
      throw queryResult.error;
    }

    const rows = (queryResult.data ?? []) as Array<{
      id: string;
      date_seance: string;
      duree_minutes: number | null;
      statut: string | null;
      notes: string | null;
      created_at: string;
      remediation_id: string;
      remediations:
        | {
            id?: string;
            attendu?: string | null;
            type_remediation?: string | null;
            classe_id?: string | null;
            assessments?: { title?: string | null } | Array<{ title?: string | null }> | null;
          }
        | Array<{
            id?: string;
            attendu?: string | null;
            type_remediation?: string | null;
            classe_id?: string | null;
            assessments?: { title?: string | null } | Array<{ title?: string | null }> | null;
          }>
        | null;
      seance_eleves:
        | Array<{
            eleve_id: string;
            students:
              | { first_name?: string | null; last_name?: string | null }
              | Array<{ first_name?: string | null; last_name?: string | null }>
              | null;
          }>
        | null;
    }>;

    const items = rows.map((row) => {
      const remediation = toOne(row.remediations as any) as any;
      const assessment = toOne(remediation?.assessments as any) as any;
      const eleves = (row.seance_eleves ?? []).map((seanceEleve) => {
        const student = toOne(seanceEleve.students as any) as any;
        return {
          eleve_id: seanceEleve.eleve_id,
          first_name: String(student?.first_name ?? ""),
          last_name: String(student?.last_name ?? ""),
        };
      });

      return {
        id: row.id,
        date_seance: row.date_seance,
        duree_minutes: row.duree_minutes ?? 30,
        statut: toDbStatut(row.statut),
        notes: row.notes ?? null,
        created_at: row.created_at,
        remediation_id: row.remediation_id,
        remediation: {
          id: remediation?.id ?? row.remediation_id,
          attendu: remediation?.attendu ?? null,
          type_remediation: remediation?.type_remediation ?? null,
          classe_id: remediation?.classe_id ?? null,
          evaluation_titre: assessment?.title ?? null,
        },
        eleves,
      };
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    await getScope(supabase);

    const body = (await req.json()) as {
      remediation_id?: string;
      date_seance?: string;
      duree_minutes?: number;
      statut?: string;
      notes?: string;
      eleve_ids?: string[];
    };

    const remediationId = body.remediation_id?.trim() ?? "";
    if (!remediationId) {
      return NextResponse.json({ error: "remediation_id manquant" }, { status: 400 });
    }

    const dateSeance = body.date_seance?.trim() ?? "";
    if (!dateSeance || !isIsoDateTime(dateSeance)) {
      return NextResponse.json({ error: "date_seance invalide (ISO attendu)" }, { status: 400 });
    }

    const duree = toInt(body.duree_minutes) ?? 30;
    if (duree <= 0) {
      return NextResponse.json({ error: "duree_minutes invalide" }, { status: 400 });
    }

    const statut = toDbStatut(body.statut);
    if (!ALLOWED_STATUTS.includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const eleveIds = uniqIds(body.eleve_ids ?? []);
    if (eleveIds.length === 0) {
      return NextResponse.json({ error: "Sélectionne au moins un élève." }, { status: 400 });
    }

    const notes = body.notes?.trim() || null;

    const insertRes = await supabase
      .from("seances_remediation")
      .insert({
        remediation_id: remediationId,
        date_seance: new Date(dateSeance).toISOString(),
        duree_minutes: duree,
        statut,
        notes,
      })
      .select("id,date_seance,duree_minutes,statut,notes,created_at,remediation_id")
      .maybeSingle();

    if (insertRes.error) throw insertRes.error;
    if (!insertRes.data) {
      return NextResponse.json({ error: "Impossible de créer la séance" }, { status: 500 });
    }

    const seanceId = insertRes.data.id as string;

    const linkRows = eleveIds.map((eleveId) => ({
      seance_id: seanceId,
      eleve_id: eleveId,
    }));

    const linkRes = await supabase
      .from("seance_eleves")
      .upsert(linkRows, { onConflict: "seance_id,eleve_id" });

    if (linkRes.error) throw linkRes.error;

    return NextResponse.json({ item: insertRes.data }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

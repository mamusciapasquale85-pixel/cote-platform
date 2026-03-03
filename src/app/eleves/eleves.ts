"use client";

import { createClient } from "@/lib/supabase/client";

export type UUID = string;

export type TeacherContext = {
  supabase: ReturnType<typeof createClient>;
  schoolId: UUID;
  academicYearId: UUID;
  teacherId: UUID;
};

export type StudentIdentity = {
  id: UUID;
  first_name: string;
  last_name: string;
  student_ref: string | null;
  email: string | null;
  parent_phone: string | null;
  parent_email: string | null;
};

export type StudentClassInfo = {
  class_group_id: UUID | null;
  class_name: string | null;
  grade_level: number | null;
};

export type StudentResult = {
  id: UUID;
  value: number | null;
  level: string | null;
  assessment_id: UUID;
  title: string;
  date: string | null;
  max_points: number | null;
  apprentissage_id: UUID | null;
  apprentissage_name: string | null;
};

export type StudentResultsPayload = {
  rows: StudentResult[];
  hasApprentissage: boolean;
};

export type Remarque = {
  id: UUID;
  type: string;
  text: string;
  created_at: string;
};

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  STUDENTS: "students",
  STUDENT_ENROLLMENTS: "student_enrollments",
  CLASS_GROUPS: "class_groups",
  RESULTATS: "resultats",
  ASSESSMENTS: "assessments",
  APPRENTISSAGES: "apprentissages",
  REMARQUES: "remarques",
  DISCIPLINE_NOTES: "discipline_notes",
} as const;

function errMessage(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    if ("message" in e && typeof e.message === "string" && e.message) return e.message;
    if ("error_description" in e && typeof e.error_description === "string" && e.error_description) {
      return e.error_description;
    }
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function toNum(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function maybeJoinedOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isMissingRemarquesTable(error: unknown): boolean {
  const msg = errMessage(error).toLowerCase();
  return msg.includes("remarques") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

function isMissingDisciplineNotesTable(error: unknown): boolean {
  const msg = errMessage(error).toLowerCase();
  return msg.includes("discipline_notes") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

function isMissingApprentissageColumn(error: unknown): boolean {
  const msg = errMessage(error).toLowerCase();
  return (
    (msg.includes("apprentissage_id") && msg.includes("does not exist")) ||
    (msg.includes("apprentissage_id") && msg.includes("schema cache")) ||
    msg.includes("assessments_1.apprentissage_id")
  );
}

export async function getTeacherContext(): Promise<TeacherContext> {
  const supabase = createClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Pas connecté");

  const { data: mem, error: memErr } = await supabase
    .from(T.SCHOOL_MEMBERSHIPS)
    .select("school_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memErr) throw memErr;
  if (!mem?.school_id) throw new Error("Impossible de trouver school_id (school_memberships).");

  const schoolId = mem.school_id as UUID;
  const teacherId = user.id as UUID;

  const { data: ay, error: ayErr } = await supabase
    .from(T.ACADEMIC_YEARS)
    .select("id")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ayErr) throw ayErr;
  if (!ay?.id) throw new Error("Aucune année scolaire trouvée.");

  return { supabase, schoolId, academicYearId: ay.id as UUID, teacherId };
}

export async function getStudentIdentity(ctx: TeacherContext, studentId: UUID): Promise<StudentIdentity> {
  const { data, error } = await ctx.supabase
    .from(T.STUDENTS)
    .select("*")
    .eq("school_id", ctx.schoolId)
    .eq("id", studentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Élève introuvable.");

  return {
    id: data.id as UUID,
    first_name: String((data as any).first_name ?? ""),
    last_name: String((data as any).last_name ?? ""),
    student_ref: ((data as any).student_ref ?? null) as string | null,
    email: ((data as any).email ?? (data as any).email_ecole ?? null) as string | null,
    parent_phone: ((data as any).parent_phone ?? null) as string | null,
    parent_email: ((data as any).parent_email ?? null) as string | null,
  };
}

export async function getCurrentClassInfo(ctx: TeacherContext, studentId: UUID): Promise<StudentClassInfo> {
  const { data, error } = await ctx.supabase
    .from(T.STUDENT_ENROLLMENTS)
    .select("class_group_id,class_groups(id,name,grade_level)")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("student_id", studentId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const classJoined = maybeJoinedOne((data as any)?.class_groups as any);
  return {
    class_group_id: ((data as any)?.class_group_id ?? null) as UUID | null,
    class_name: (classJoined as any)?.name ?? null,
    grade_level: ((classJoined as any)?.grade_level ?? null) as number | null,
  };
}

export async function listStudentResults(ctx: TeacherContext, studentId: UUID): Promise<StudentResultsPayload> {
  let apprentissageColumnAvailable = true;
  let queryResult: any = await ctx.supabase
    .from(T.RESULTATS)
    .select("id,value,level,assessment_id,assessments(id,title,date,max_points,apprentissage_id)")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (queryResult.error && isMissingApprentissageColumn(queryResult.error)) {
    apprentissageColumnAvailable = false;
    queryResult = await ctx.supabase
      .from(T.RESULTATS)
      .select("id,value,level,assessment_id,assessments(id,title,date,max_points)")
      .eq("school_id", ctx.schoolId)
      .eq("academic_year_id", ctx.academicYearId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
  }

  if (queryResult.error) throw queryResult.error;

  const rows = (queryResult.data ?? []) as any[];
  const apprentissageIds = Array.from(
    new Set(
      rows
        .map((row) => maybeJoinedOne(row.assessments as any)?.apprentissage_id)
        .filter(Boolean)
    )
  ) as UUID[];

  const apprentissageById = new Map<UUID, string>();
  if (apprentissageColumnAvailable && apprentissageIds.length > 0) {
    const appRes = await ctx.supabase
      .from(T.APPRENTISSAGES)
      .select("id,name")
      .in("id", apprentissageIds);

    if (!appRes.error) {
      for (const a of appRes.data ?? []) apprentissageById.set((a as any).id as UUID, String((a as any).name ?? ""));
    }
  }

  const mappedRows = rows.map((row) => {
    const a = maybeJoinedOne(row.assessments as any) as any;
    const apprentissageId = apprentissageColumnAvailable ? ((a?.apprentissage_id ?? null) as UUID | null) : null;
    return {
      id: row.id as UUID,
      value: toNum(row.value),
      level: (row.level ?? null) as string | null,
      assessment_id: row.assessment_id as UUID,
      title: String(a?.title ?? "Évaluation"),
      date: (a?.date ?? null) as string | null,
      max_points: toNum(a?.max_points),
      apprentissage_id: apprentissageId,
      apprentissage_name: apprentissageId ? apprentissageById.get(apprentissageId) ?? null : null,
    };
  });

  return {
    rows: mappedRows,
    hasApprentissage: apprentissageColumnAvailable,
  };
}

export async function listRecentRemarques(ctx: TeacherContext, studentId: UUID, limit = 5): Promise<{
  rows: Remarque[];
  tableMissing: boolean;
}> {
  if (!studentId) return { rows: [], tableMissing: false };

  const { data, error } = await ctx.supabase
    .from(T.REMARQUES)
    .select("id,type,text,created_at")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (!isMissingRemarquesTable(error)) throw error;

    const runFallback = async (teacherColumn: "teacher_id" | "teacher_user_id") =>
      ctx.supabase
        .from(T.DISCIPLINE_NOTES)
        .select("id,note,created_at,date")
        .eq("school_id", ctx.schoolId)
        .eq("academic_year_id", ctx.academicYearId)
        .eq(teacherColumn, ctx.teacherId)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(limit);

    let fallback = await runFallback("teacher_id");
    if (fallback.error) {
      const msg = errMessage(fallback.error).toLowerCase();
      if (msg.includes("teacher_id") && (msg.includes("schema cache") || msg.includes("does not exist"))) {
        fallback = await runFallback("teacher_user_id");
      }
    }

    if (fallback.error) {
      if (isMissingDisciplineNotesTable(fallback.error)) return { rows: [], tableMissing: true };
      throw fallback.error;
    }

    return {
      rows: (fallback.data ?? []).map((row: any) => ({
        id: row.id as UUID,
        type: "discipline",
        text: String(row.note ?? ""),
        created_at: (row.created_at ?? `${String(row.date)}T00:00:00.000Z`) as string,
      })),
      tableMissing: false,
    };
  }

  return { rows: (data ?? []) as Remarque[], tableMissing: false };
}

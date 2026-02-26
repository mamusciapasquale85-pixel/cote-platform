"use client";

import { createClient } from "@/lib/supabase/client";

export type UUID = string;
export type Level = "NI" | "I" | "S" | "B" | "TB";

export type TeacherContext = {
  supabase: ReturnType<typeof createClient>;
  schoolId: UUID;
  teacherId: UUID;
  academicYearId: UUID;
};

export type ClassGroup = {
  id: UUID;
  name: string;
  grade_level: number | null;
  teacher_id?: UUID | null; // optionnel (utile si tu filtres par prof)
};

export type Student = {
  id: UUID;
  first_name: string;
  last_name: string;
  student_ref?: string | null;
};

export type Assessment = {
  id: UUID;
  title: string;
  max_points: number | null;
};

export type Resultat = {
  id: UUID;
  school_id: UUID;
  academic_year_id: UUID;
  teacher_id: UUID;
  student_id: UUID;
  assessment_id: UUID;
  value: number | null;
  level: Level | null;
  created_at: string;
  updated_at: string;

  // Join Supabase (si relation FK existe resultats.assessment_id -> assessments.id)
  assessments?: { title: string; max_points: number | null } | null;
};

export type AttendanceStatus = "present" | "absent";

export type AttendanceRecord = {
  id?: UUID;
  school_id: UUID;
  academic_year_id: UUID;
  teacher_id: UUID;
  class_group_id: UUID;
  student_id: UUID;
  date: string;
  status: AttendanceStatus;
  created_at?: string;
  updated_at?: string;
};

export type CsvStudentImportRow = {
  line: number;
  first_name: string;
  last_name: string;
  student_ref?: string | null;
  email?: string | null;
};

export type CsvStudentImportError = {
  line: number;
  message: string;
};

export type CsvStudentImportSummary = {
  rowsTotal: number;
  rowsValid: number;
  studentsCreated: number;
  studentsExisting: number;
  enrollmentsCreated: number;
  enrollmentsExisting: number;
  errors: CsvStudentImportError[];
};

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  CLASS_GROUPS: "class_groups",
  STUDENTS: "students",
  STUDENT_ENROLLMENTS: "student_enrollments",
  ASSESSMENTS: "assessments",
  RESULTATS: "resultats",
  ATTENDANCE_RECORDS: "attendance_records",
} as const;

// IMPORTANT: doit correspondre à une contrainte UNIQUE dans ta DB
// UNIQUE(student_id, assessment_id)
const RESULTATS_ON_CONFLICT = "student_id,assessment_id";
const ENROLLMENTS_ON_CONFLICT_CANDIDATES = [
  "student_id,class_group_id,academic_year_id",
  "school_id,student_id,class_group_id,academic_year_id",
  "school_id,academic_year_id,class_group_id,student_id",
] as const;

function isNoUniqueForOnConflict(err: any): boolean {
  const msg = String(err?.message ?? "").toLowerCase();
  return msg.includes("no unique") || msg.includes("constraint matching");
}

function importErrorMessage(error: unknown): string {
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

function isMissingStudentRefColumn(error: unknown): boolean {
  const msg = importErrorMessage(error).toLowerCase();
  return msg.includes("student_ref") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

function isMissingEmailColumn(error: unknown): boolean {
  const msg = importErrorMessage(error).toLowerCase();
  return msg.includes("email") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

function isMissingAttendanceTable(error: unknown): boolean {
  const msg = importErrorMessage(error).toLowerCase();
  return msg.includes("attendance_records") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

type StudentEnrollmentInsert = {
  school_id: UUID;
  academic_year_id: UUID;
  class_group_id: UUID;
  student_id: UUID;
};

function isDuplicateKeyError(err: any): boolean {
  return String(err?.code) === "23505";
}

async function upsertStudentEnrollmentWithFallback(
  ctx: TeacherContext,
  row: StudentEnrollmentInsert
): Promise<"inserted" | "existing"> {
  let lastConflictError: unknown = null;
  for (const onConflict of ENROLLMENTS_ON_CONFLICT_CANDIDATES) {
    const { error } = await ctx.supabase.from(T.STUDENT_ENROLLMENTS).upsert(row, { onConflict });
    if (!error) return "inserted";
    if (isDuplicateKeyError(error)) return "existing";
    if (!isNoUniqueForOnConflict(error)) throw error;
    lastConflictError = error;
  }

  // Fallback robuste: certains schémas n'ont pas forcément la contrainte UNIQUE
  // attendue pour l'upsert onConflict. On tente alors un insert simple.
  const { error: insertError } = await ctx.supabase.from(T.STUDENT_ENROLLMENTS).insert(row);
  if (!insertError) return "inserted";
  if (isDuplicateKeyError(insertError)) return "existing";

  if (lastConflictError) throw lastConflictError;
  throw insertError;
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
  if (!ay?.id) throw new Error("Aucune année scolaire trouvée (academic_years).");

  return { supabase, schoolId, teacherId, academicYearId: ay.id as UUID };
}

export async function listClassGroups(ctx: TeacherContext): Promise<ClassGroup[]> {
  const { data, error } = await ctx.supabase
    .from(T.CLASS_GROUPS)
    .select("id,name,grade_level,teacher_id")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .or(`teacher_id.eq.${ctx.teacherId},teacher_id.is.null`)
    .order("grade_level", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ClassGroup[];
}

export async function upsertClassGroup(
  ctx: TeacherContext,
  params: { name: string; grade_level: number }
): Promise<UUID> {
  const name = params.name.trim();
  if (!name) throw new Error("Nom de classe vide.");

  const { data, error } = await ctx.supabase
    .from(T.CLASS_GROUPS)
    .upsert(
      {
        school_id: ctx.schoolId,
        academic_year_id: ctx.academicYearId,
        teacher_id: ctx.teacherId,
        name,
        grade_level: params.grade_level,
      },
      { onConflict: "school_id,academic_year_id,name" }
    )
    .select("id")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error("Impossible de créer la classe.");
  return data.id as UUID;
}

export async function deleteClassGroup(ctx: TeacherContext, classGroupId: UUID): Promise<void> {
  const { error } = await ctx.supabase
    .from(T.CLASS_GROUPS)
    .delete()
    .eq("id", classGroupId)
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId);

  if (error) throw error;
}

export async function addStudentAndEnroll(
  ctx: TeacherContext,
  params: { classGroupId: UUID; first_name: string; last_name: string }
): Promise<UUID> {
  const first_name = params.first_name.trim();
  const last_name = params.last_name.trim();
  if (!first_name || !last_name) throw new Error("Prénom/nom requis.");

  const { data: stu, error: stuErr } = await ctx.supabase
    .from(T.STUDENTS)
    .insert({ school_id: ctx.schoolId, first_name, last_name })
    .select("id")
    .limit(1)
    .maybeSingle();

  if (stuErr) throw stuErr;
  if (!stu?.id) throw new Error("Impossible de créer l'élève.");

  const studentId = stu.id as UUID;

  await upsertStudentEnrollmentWithFallback(ctx, {
    school_id: ctx.schoolId,
    academic_year_id: ctx.academicYearId,
    class_group_id: params.classGroupId,
    student_id: studentId,
  });

  return studentId;
}

type ImportMatchMode = "created" | "matched_ref" | "matched_name";
type ImportStudentRuntime = {
  studentRefColumnAvailable: boolean | null;
  emailColumnAvailable: boolean | null;
  byRef: Map<string, UUID>;
  byName: Map<string, UUID>;
};

async function ensureStudentForImport(
  ctx: TeacherContext,
  row: CsvStudentImportRow,
  runtime: ImportStudentRuntime
): Promise<{ studentId: UUID; mode: ImportMatchMode }> {
  const first_name = row.first_name.trim();
  const last_name = row.last_name.trim();
  const student_ref = row.student_ref?.trim() ?? "";
  const email = row.email?.trim() ?? "";
  const nameKey = `${first_name.toLowerCase()}|${last_name.toLowerCase()}`;

  if (student_ref && runtime.byRef.has(student_ref)) {
    return { studentId: runtime.byRef.get(student_ref) as UUID, mode: "matched_ref" };
  }
  if (runtime.byName.has(nameKey)) {
    return { studentId: runtime.byName.get(nameKey) as UUID, mode: "matched_name" };
  }

  if (student_ref && runtime.studentRefColumnAvailable !== false) {
    const byRef = await ctx.supabase
      .from(T.STUDENTS)
      .select("id")
      .eq("school_id", ctx.schoolId)
      .eq("student_ref", student_ref)
      .limit(1)
      .maybeSingle();

    if (byRef.error) {
      if (isMissingStudentRefColumn(byRef.error)) {
        runtime.studentRefColumnAvailable = false;
      } else {
        throw byRef.error;
      }
    } else {
      runtime.studentRefColumnAvailable = true;
      if (byRef.data?.id) {
        const sid = byRef.data.id as UUID;
        runtime.byRef.set(student_ref, sid);
        runtime.byName.set(nameKey, sid);
        if (email) {
          let update = await ctx.supabase
            .from(T.STUDENTS)
            .update({ email })
            .eq("id", sid)
            .eq("school_id", ctx.schoolId);
          if (update.error && isMissingEmailColumn(update.error)) {
            runtime.emailColumnAvailable = false;
          } else if (!update.error) {
            runtime.emailColumnAvailable = true;
          }
        }
        return { studentId: sid, mode: "matched_ref" };
      }
    }
  }

  const byName = await ctx.supabase
    .from(T.STUDENTS)
    .select("id")
    .eq("school_id", ctx.schoolId)
    .ilike("first_name", first_name)
    .ilike("last_name", last_name)
    .limit(1)
    .maybeSingle();

  if (byName.error) throw byName.error;
  if (byName.data?.id) {
    const sid = byName.data.id as UUID;
    runtime.byName.set(nameKey, sid);
    if (student_ref) runtime.byRef.set(student_ref, sid);
    if (email) {
      let update = await ctx.supabase
        .from(T.STUDENTS)
        .update({ email })
        .eq("id", sid)
        .eq("school_id", ctx.schoolId);
      if (update.error && isMissingEmailColumn(update.error)) {
        runtime.emailColumnAvailable = false;
      } else if (!update.error) {
        runtime.emailColumnAvailable = true;
      }
    }
    return { studentId: sid, mode: "matched_name" };
  }

  const payload: Record<string, unknown> = {
    school_id: ctx.schoolId,
    first_name,
    last_name,
  };
  if (student_ref && runtime.studentRefColumnAvailable !== false) payload.student_ref = student_ref;
  if (email && runtime.emailColumnAvailable !== false) payload.email = email;

  let created = await ctx.supabase.from(T.STUDENTS).insert(payload).select("id").limit(1).maybeSingle();

  if (created.error && "student_ref" in payload && isMissingStudentRefColumn(created.error)) {
    runtime.studentRefColumnAvailable = false;
    const fallback = { ...payload };
    delete fallback.student_ref;
    created = await ctx.supabase.from(T.STUDENTS).insert(fallback).select("id").limit(1).maybeSingle();
  }

  if (created.error && "email" in payload && isMissingEmailColumn(created.error)) {
    runtime.emailColumnAvailable = false;
    const fallback = { ...payload };
    delete fallback.email;
    created = await ctx.supabase.from(T.STUDENTS).insert(fallback).select("id").limit(1).maybeSingle();
  }

  if (created.error) throw created.error;
  if (!created.data?.id) throw new Error("Impossible de créer l'élève.");

  const sid = created.data.id as UUID;
  runtime.byName.set(nameKey, sid);
  if (student_ref) runtime.byRef.set(student_ref, sid);
  return { studentId: sid, mode: "created" };
}

export async function importStudentsToClass(
  ctx: TeacherContext,
  params: { classGroupId: UUID; rows: CsvStudentImportRow[] }
): Promise<CsvStudentImportSummary> {
  const summary: CsvStudentImportSummary = {
    rowsTotal: params.rows.length,
    rowsValid: 0,
    studentsCreated: 0,
    studentsExisting: 0,
    enrollmentsCreated: 0,
    enrollmentsExisting: 0,
    errors: [],
  };

  const runtime: ImportStudentRuntime = {
    studentRefColumnAvailable: null,
    emailColumnAvailable: null,
    byRef: new Map<string, UUID>(),
    byName: new Map<string, UUID>(),
  };

  const { data: existingEnrollmentRows, error: existingEnrollmentErr } = await ctx.supabase
    .from(T.STUDENT_ENROLLMENTS)
    .select("student_id")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("class_group_id", params.classGroupId);

  if (existingEnrollmentErr) throw existingEnrollmentErr;
  const existingEnrollmentStudentIds = new Set(
    ((existingEnrollmentRows ?? []).map((r: any) => r.student_id).filter(Boolean) as UUID[])
  );

  for (const raw of params.rows) {
    const first = raw.first_name.trim();
    const last = raw.last_name.trim();
    const ref = raw.student_ref?.trim() ?? null;
    const email = raw.email?.trim() ?? null;

    if (!first || !last) {
      summary.errors.push({ line: raw.line, message: "first_name/last_name manquant(s)." });
      continue;
    }

    try {
      const ensured = await ensureStudentForImport(
        ctx,
        { line: raw.line, first_name: first, last_name: last, student_ref: ref, email },
        runtime
      );

      if (ensured.mode === "created") summary.studentsCreated += 1;
      else summary.studentsExisting += 1;

      const enrollmentAlreadyExists = existingEnrollmentStudentIds.has(ensured.studentId);
      if (enrollmentAlreadyExists) {
        summary.enrollmentsExisting += 1;
        summary.rowsValid += 1;
        continue;
      }

      const enrollmentStatus = await upsertStudentEnrollmentWithFallback(ctx, {
        school_id: ctx.schoolId,
        academic_year_id: ctx.academicYearId,
        class_group_id: params.classGroupId,
        student_id: ensured.studentId,
      });

      if (enrollmentStatus === "existing") summary.enrollmentsExisting += 1;
      else summary.enrollmentsCreated += 1;
      existingEnrollmentStudentIds.add(ensured.studentId);

      summary.rowsValid += 1;
    } catch (error: unknown) {
      summary.errors.push({ line: raw.line, message: importErrorMessage(error) });
    }
  }

  return summary;
}

export async function listStudentsInClass(ctx: TeacherContext, classGroupId: UUID): Promise<Student[]> {
  const { data: enr, error: enrErr } = await ctx.supabase
    .from(T.STUDENT_ENROLLMENTS)
    .select("student_id")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("class_group_id", classGroupId);

  if (enrErr) throw enrErr;

  const ids = (enr ?? []).map((r: any) => r.student_id).filter(Boolean) as UUID[];
  if (ids.length === 0) return [];

  const { data: students, error } = await ctx.supabase
    .from(T.STUDENTS)
    .select("id,first_name,last_name")
    .eq("school_id", ctx.schoolId)
    .in("id", ids)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) throw error;
  return (students ?? []) as Student[];
}

export async function listAssessmentsForClass(ctx: TeacherContext, classGroupId: UUID): Promise<Assessment[]> {
  const { data, error } = await ctx.supabase
    .from(T.ASSESSMENTS)
    .select("id,title,max_points")
    .eq("school_id", ctx.schoolId)
    // assessments n'a pas de colonne academic_year_id dans ce schéma.
    // Le scope année est déjà indirectement garanti par class_group_id.
    .eq("class_group_id", classGroupId)
    .eq("teacher_user_id", ctx.teacherId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Assessment[];
}

export async function upsertResult(
  ctx: TeacherContext,
  params: { studentId: UUID; assessmentId: UUID; value: number | null; level: Level | null }
): Promise<void> {
  if (params.value === null && params.level === null) {
    throw new Error("Choisis une note (value) ou un niveau (level).");
  }

  const row = {
    school_id: ctx.schoolId,
    academic_year_id: ctx.academicYearId,
    teacher_id: ctx.teacherId,
    student_id: params.studentId,
    assessment_id: params.assessmentId,
    value: params.value,
    level: params.level,
  };

  const { error } = await ctx.supabase.from(T.RESULTATS).upsert(row, {
    onConflict: RESULTATS_ON_CONFLICT,
  });

  if (error) {
    if (isNoUniqueForOnConflict(error)) {
      throw new Error(
        "Contrainte UNIQUE manquante pour l'UPSERT. Il faut un UNIQUE sur (student_id, assessment_id)."
      );
    }
    throw error;
  }
}

export async function listResultatsForStudent(
  ctx: TeacherContext,
  params: { studentId: UUID }
): Promise<Resultat[]> {
  type AssessmentJoin = { title: string; max_points: number | null };
  type ResultatRow = Omit<Resultat, "assessments"> & {
    assessments?: AssessmentJoin | AssessmentJoin[] | null;
  };

  // ✅ On fait directement le join vers assessments
  const { data, error } = await ctx.supabase
    .from(T.RESULTATS)
    .select(
      "id,school_id,academic_year_id,teacher_id,student_id,assessment_id,value,level,created_at,updated_at,assessments(title,max_points)"
    )
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("student_id", params.studentId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as ResultatRow[];
  return rows.map((row) => ({
    ...row,
    assessments: Array.isArray(row.assessments) ? (row.assessments[0] ?? null) : (row.assessments ?? null),
  }));
}

export async function listStudentsForClasses(
  ctx: TeacherContext,
  classGroupIds: UUID[]
): Promise<Record<UUID, Student[]>> {
  const ids = Array.from(new Set(classGroupIds.filter(Boolean)));
  const out: Record<UUID, Student[]> = {};
  for (const classId of ids) out[classId] = [];
  if (ids.length === 0) return out;

  const { data: enrollments, error: enrErr } = await ctx.supabase
    .from(T.STUDENT_ENROLLMENTS)
    .select("class_group_id,student_id")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .in("class_group_id", ids);

  if (enrErr) throw enrErr;

  const studentIds = Array.from(
    new Set((enrollments ?? []).map((row: any) => row.student_id).filter(Boolean) as UUID[])
  );
  if (studentIds.length === 0) return out;

  const { data: students, error: stuErr } = await ctx.supabase
    .from(T.STUDENTS)
    .select("id,first_name,last_name")
    .eq("school_id", ctx.schoolId)
    .in("id", studentIds);

  if (stuErr) throw stuErr;
  const byId = new Map<UUID, Student>();
  for (const s of (students ?? []) as Student[]) byId.set(s.id, s);

  for (const enr of (enrollments ?? []) as Array<{ class_group_id: UUID; student_id: UUID }>) {
    const student = byId.get(enr.student_id);
    if (!student) continue;
    if (!out[enr.class_group_id]) out[enr.class_group_id] = [];
    out[enr.class_group_id].push(student);
  }

  for (const classId of Object.keys(out)) {
    out[classId as UUID].sort((a, b) => {
      const last = a.last_name.localeCompare(b.last_name, "fr", { sensitivity: "base" });
      if (last !== 0) return last;
      return a.first_name.localeCompare(b.first_name, "fr", { sensitivity: "base" });
    });
  }

  return out;
}

export async function listAttendanceForDate(
  ctx: TeacherContext,
  params: { date: string; classGroupIds?: UUID[] }
): Promise<AttendanceRecord[]> {
  let query = ctx.supabase
    .from(T.ATTENDANCE_RECORDS)
    .select("id,school_id,academic_year_id,teacher_id,class_group_id,student_id,date,status,created_at,updated_at")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("date", params.date);

  if (params.classGroupIds && params.classGroupIds.length > 0) {
    query = query.in("class_group_id", params.classGroupIds);
  }

  const { data, error } = await query;
  if (error) {
    // Mode dégradé: si la table de présence n'est pas encore migrée, on n'empêche pas
    // l'écran Classes/Élèves de fonctionner.
    if (isMissingAttendanceTable(error)) return [];
    throw error;
  }
  return (data ?? []) as AttendanceRecord[];
}

export async function upsertAttendanceForClass(
  ctx: TeacherContext,
  params: {
    classGroupId: UUID;
    date: string;
    rows: Array<{ studentId: UUID; status: AttendanceStatus }>;
  }
): Promise<void> {
  if (!params.classGroupId) throw new Error("Classe manquante.");
  if (!params.date) throw new Error("Date manquante.");
  if (!params.rows.length) return;

  const payload = params.rows.map((row) => ({
    school_id: ctx.schoolId,
    academic_year_id: ctx.academicYearId,
    teacher_id: ctx.teacherId,
    class_group_id: params.classGroupId,
    student_id: row.studentId,
    date: params.date,
    status: row.status,
  }));

  const { error } = await ctx.supabase.from(T.ATTENDANCE_RECORDS).upsert(payload, {
    onConflict: "student_id,class_group_id,date",
  });

  if (error) {
    if (isMissingAttendanceTable(error)) {
      throw new Error(
        "Le module de présence n'est pas activé (table attendance_records absente). Applique la migration SQL puis réessaie."
      );
    }
    throw error;
  }
}

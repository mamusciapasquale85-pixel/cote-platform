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

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  CLASS_GROUPS: "class_groups",
  STUDENTS: "students",
  STUDENT_ENROLLMENTS: "student_enrollments",
  ASSESSMENTS: "assessments",
  RESULTATS: "resultats",
} as const;

// IMPORTANT: doit correspondre à une contrainte UNIQUE dans ta DB
// UNIQUE(student_id, assessment_id)
const RESULTATS_ON_CONFLICT = "student_id,assessment_id";

function isNoUniqueForOnConflict(err: any): boolean {
  const msg = String(err?.message ?? "").toLowerCase();
  return msg.includes("no unique") || msg.includes("constraint matching");
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

  const { error: enrErr } = await ctx.supabase.from(T.STUDENT_ENROLLMENTS).upsert(
    {
      school_id: ctx.schoolId,
      academic_year_id: ctx.academicYearId,
      class_group_id: params.classGroupId,
      student_id: studentId,
    },
    { onConflict: "student_id,class_group_id,academic_year_id" }
  );

  if (enrErr && String(enrErr.code) !== "23505") throw enrErr;

  return studentId;
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
    .eq("academic_year_id", ctx.academicYearId)
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

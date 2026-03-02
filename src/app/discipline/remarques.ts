"use client";

import { createClient } from "@/lib/supabase/client";

export type UUID = string;
export type RemarqueType = "discipline" | "suivi" | "parent" | "retard" | "materiel" | "autre";

export type TeacherContext = {
  supabase: ReturnType<typeof createClient>;
  schoolId: UUID;
  academicYearId: UUID;
  teacherId: UUID;
};

export type StudentLite = {
  id: UUID;
  first_name: string;
  last_name: string;
};

export type Remarque = {
  id: UUID;
  student_id: UUID;
  type: RemarqueType | string;
  text: string;
  created_at: string;
};

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  STUDENTS: "students",
  REMARQUES: "remarques",
} as const;

export function toNiceError(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message) return error.message;
    if ("error_description" in error && typeof error.error_description === "string" && error.error_description) {
      return error.error_description;
    }
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function isMissingRemarquesTable(error: unknown): boolean {
  const msg = toNiceError(error).toLowerCase();
  return msg.includes("public.remarques") && (msg.includes("schema cache") || msg.includes("does not exist"));
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

export async function listStudents(ctx: TeacherContext): Promise<StudentLite[]> {
  const { data, error } = await ctx.supabase
    .from(T.STUDENTS)
    .select("id,first_name,last_name")
    .eq("school_id", ctx.schoolId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StudentLite[];
}

export async function createRemarque(
  ctx: TeacherContext,
  params: { student_id: UUID; type: RemarqueType | string; text: string }
): Promise<void> {
  const text = params.text.trim();
  if (!params.student_id) throw new Error("Élève obligatoire.");
  if (!text) throw new Error("Texte obligatoire.");

  const { error } = await ctx.supabase.from(T.REMARQUES).insert({
    school_id: ctx.schoolId,
    academic_year_id: ctx.academicYearId,
    teacher_id: ctx.teacherId,
    student_id: params.student_id,
    type: (params.type || "discipline").toLowerCase(),
    text,
  });
  if (error) {
    if (isMissingRemarquesTable(error)) {
      throw new Error("La table remarques n'existe pas encore. Applique la migration SQL.");
    }
    throw error;
  }
}

export async function listRemarquesForStudent(ctx: TeacherContext, studentId: UUID): Promise<Remarque[]> {
  if (!studentId) return [];

  const { data, error } = await ctx.supabase
    .from(T.REMARQUES)
    .select("id,student_id,type,text,created_at")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingRemarquesTable(error)) return [];
    throw error;
  }

  return (data ?? []) as Remarque[];
}

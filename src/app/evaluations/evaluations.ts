"use client";

import { createClient } from "@/lib/supabase/client";

export type UUID = string;

export type TeacherContext = {
  supabase: ReturnType<typeof createClient>;
  schoolId: UUID;
  academicYearId: UUID;
  teacherUserId: UUID;
};

export type ClassGroup = {
  id: UUID;
  name: string;
  grade_level: number | null;
};

export type Course = {
  id: UUID;
  name: string;
};

export type Apprentissage = {
  id: UUID;
  name: string;
  order_index: number;
  active: boolean;
};

export type AssessmentType = "formative" | "summative";
export type ContentStatus = "draft" | "published" | "archived";

export type Assessment = {
  id: UUID;
  title: string;
  type: AssessmentType;
  date: string; // YYYY-MM-DD
  max_points: number | null;
  weight: number | null;
  status: ContentStatus;
  parent_visible: boolean;
  instructions: string | null;
  class_group_id: UUID | null;
  course_id: UUID | null;
  apprentissage_id: UUID | null;
  created_at: string;
  updated_at: string;
};

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  CLASS_GROUPS: "class_groups",
  COURSES: "courses",
  APPRENTISSAGES: "apprentissages",
  ASSESSMENTS: "assessments",
} as const;

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

  const schoolId: UUID = mem.school_id;
  const teacherUserId: UUID = user.id;

  const { data: ay, error: ayErr } = await supabase
    .from(T.ACADEMIC_YEARS)
    .select("id")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ayErr) throw ayErr;
  if (!ay?.id) throw new Error("Aucune année scolaire trouvée (academic_years).");

  return { supabase, schoolId, academicYearId: ay.id, teacherUserId };
}

export async function listClassGroups(ctx: TeacherContext): Promise<ClassGroup[]> {
  const { data, error } = await ctx.supabase
    .from(T.CLASS_GROUPS)
    .select("id, name, grade_level")
    .eq("school_id", ctx.schoolId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ClassGroup[];
}

export async function listCourses(ctx: TeacherContext): Promise<Course[]> {
  const { data, error } = await ctx.supabase
    .from(T.COURSES)
    .select("id, name")
    .eq("school_id", ctx.schoolId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Course[];
}

export async function listApprentissages(ctx: TeacherContext): Promise<Apprentissage[]> {
  const { data, error } = await ctx.supabase
    .from(T.APPRENTISSAGES)
    .select("id, name, order_index, active")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .order("order_index", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Apprentissage[];
}

export async function listAssessments(params: {
  ctx: TeacherContext;
  classGroupId?: UUID | null;
  courseId?: UUID | null;
  apprentissageId?: UUID | null;
}): Promise<Assessment[]> {
  const { ctx } = params;

  let q = ctx.supabase
    .from(T.ASSESSMENTS)
    .select(
      "id, title, type, date, max_points, weight, status, parent_visible, instructions, class_group_id, course_id, apprentissage_id, created_at, updated_at"
    )
    .eq("school_id", ctx.schoolId)
    .eq("teacher_user_id", ctx.teacherUserId)
    .order("date", { ascending: false });

  if (params.classGroupId) q = q.eq("class_group_id", params.classGroupId);
  if (params.courseId) q = q.eq("course_id", params.courseId);
  if (params.apprentissageId) q = q.eq("apprentissage_id", params.apprentissageId);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []) as Assessment[];
}

export async function createAssessment(params: {
  ctx: TeacherContext;
  title: string;
  type: AssessmentType;
  date: string;
  max_points: number | null;
  weight: number | null;
  status: ContentStatus;
  parent_visible: boolean;
  instructions: string | null;
  class_group_id: UUID | null;
  course_id: UUID | null;
  apprentissage_id: UUID | null;
}): Promise<Assessment> {
  const { ctx, ...rest } = params;

  const payload = {
    school_id: ctx.schoolId,
    teacher_user_id: ctx.teacherUserId,
    ...rest,
  };

  const { data, error } = await ctx.supabase
    .from(T.ASSESSMENTS)
    .insert(payload)
    .select(
      "id, title, type, date, max_points, weight, status, parent_visible, instructions, class_group_id, course_id, apprentissage_id, created_at, updated_at"
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Création échouée (pas de retour).");

  return data as Assessment;
}

export async function updateAssessment(params: {
  ctx: TeacherContext;
  assessmentId: UUID;
  patch: Partial<
    Pick<
      Assessment,
      | "title"
      | "type"
      | "date"
      | "max_points"
      | "weight"
      | "status"
      | "parent_visible"
      | "instructions"
      | "class_group_id"
      | "course_id"
      | "apprentissage_id"
    >
  >;
}): Promise<Assessment> {
  const { ctx, assessmentId, patch } = params;

  const { data, error } = await ctx.supabase
    .from(T.ASSESSMENTS)
    .update(patch)
    .eq("id", assessmentId)
    .eq("school_id", ctx.schoolId)
    .eq("teacher_user_id", ctx.teacherUserId)
    .select(
      "id, title, type, date, max_points, weight, status, parent_visible, instructions, class_group_id, course_id, apprentissage_id, created_at, updated_at"
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Mise à jour échouée (pas de retour).");

  return data as Assessment;
}

export async function deleteAssessment(params: { ctx: TeacherContext; assessmentId: UUID }): Promise<void> {
  const { ctx, assessmentId } = params;

  const { error } = await ctx.supabase
    .from(T.ASSESSMENTS)
    .delete()
    .eq("id", assessmentId)
    .eq("school_id", ctx.schoolId)
    .eq("teacher_user_id", ctx.teacherUserId);

  if (error) throw error;
}

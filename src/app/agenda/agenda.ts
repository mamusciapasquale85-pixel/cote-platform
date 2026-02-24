import { createClient } from "@/lib/supabase/client";

export type UUID = string;
export type AgendaType = "lesson" | "homework" | "test";

export type ClassGroup = {
  id: UUID;
  name: string;
  grade_level: number | null;
};

export type AgendaItem = {
  id: UUID;
  school_id: UUID;
  academic_year_id: UUID;
  teacher_id: UUID;
  class_group_id: UUID | null;

  date: string; // YYYY-MM-DD
  type: AgendaType;
  title: string;
  details: string | null;

  created_at: string;
  updated_at: string;

  // join (many-to-one) – parfois objet, parfois tableau selon la relation
  class_groups?: ClassGroup | ClassGroup[] | null;
};

export type TeacherContext = {
  supabase: ReturnType<typeof createClient>;
  schoolId: UUID;
  academicYearId: UUID;
  teacherId: UUID;
};

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  CLASS_GROUPS: "class_groups",
  AGENDA_ITEMS: "agenda_items",
} as const;

function normalizeClassGroup(joinValue: any): ClassGroup | null {
  if (!joinValue) return null;
  if (Array.isArray(joinValue)) return (joinValue[0] ?? null) as ClassGroup | null;
  return joinValue as ClassGroup;
}

export async function getTeacherContext(): Promise<TeacherContext> {
  const supabase = createClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Pas connecté");

  // 1) Trouver l'école via school_memberships
  const { data: mem, error: memErr } = await supabase
    .from(T.SCHOOL_MEMBERSHIPS)
    .select("school_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memErr) throw memErr;
  if (!mem?.school_id) throw new Error("Impossible de trouver school_id (school_memberships).");

  const schoolId: UUID = mem.school_id;
  const teacherId: UUID = user.id;

  // 2) Année scolaire la plus récente
  const { data: ay, error: ayErr } = await supabase
    .from(T.ACADEMIC_YEARS)
    .select("id")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ayErr) throw ayErr;
  if (!ay?.id) throw new Error("Aucune année scolaire trouvée (academic_years).");

  const academicYearId: UUID = ay.id;

  return { supabase, schoolId, academicYearId, teacherId };
}

export async function listClassGroups(ctx: TeacherContext): Promise<ClassGroup[]> {
  const { data, error } = await ctx.supabase
    .from(T.CLASS_GROUPS)
    .select("id, name, grade_level")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ClassGroup[];
}

export async function listAgendaItems(params: {
  ctx: TeacherContext;
  dateFrom: string;
  dateTo: string;
  classGroupId?: UUID;
}): Promise<AgendaItem[]> {
  const { ctx, dateFrom, dateTo, classGroupId } = params;

  let q = ctx.supabase
    .from(T.AGENDA_ITEMS)
    .select(
      "id, school_id, academic_year_id, teacher_id, class_group_id, date, type, title, details, created_at, updated_at, class_groups ( id, name, grade_level )"
    )
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (classGroupId) q = q.eq("class_group_id", classGroupId);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as any[];

  // ✅ normalisation du join class_groups (objet vs tableau)
  return rows.map((r) => ({
    ...(r as any),
    class_groups: normalizeClassGroup((r as any).class_groups),
  })) as AgendaItem[];
}

export async function createAgendaItem(params: {
  ctx: TeacherContext;
  classGroupId: UUID | null;
  date: string;
  type: AgendaType;
  title: string;
  details: string | null;
}): Promise<void> {
  const { ctx, classGroupId, date, type, title, details } = params;

  const { error } = await ctx.supabase.from(T.AGENDA_ITEMS).insert({
    school_id: ctx.schoolId,
    academic_year_id: ctx.academicYearId,
    teacher_id: ctx.teacherId,
    class_group_id: classGroupId,
    date,
    type,
    title,
    details,
  });

  if (error) throw error;
}

export async function deleteAgendaItem(params: { ctx: TeacherContext; id: UUID }): Promise<void> {
  const { ctx, id } = params;
  const { error } = await ctx.supabase
    .from(T.AGENDA_ITEMS)
    .delete()
    .eq("id", id)
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId);

  if (error) throw error;
}
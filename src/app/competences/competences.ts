"use client";

import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

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
};

export type Student = {
  id: UUID;
  first_name: string;
  last_name: string;
};

export type Apprentissage = {
  id: UUID;
  name: string;
  order_index: number;
  active: boolean;
};

export type Assessment = {
  id: UUID;
  title: string;
  date: string;
  apprentissage_id: UUID | null;
  max_points: number | null;
};

export type Resultat = {
  student_id: UUID;
  assessment_id: UUID;
  level: Level | null;
  value: number | null;
};

// Grid: { [apprentissageId]: { [studentId]: Level | null } }
export type CompetenceGrid = Record<UUID, Record<UUID, Level | null>>;

export type SchoolTemplate = {
  school_name: string;
  teacher_name: string;
  address: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  CLASS_GROUPS: "class_groups",
  STUDENTS: "students",
  STUDENT_ENROLLMENTS: "student_enrollments",
  ASSESSMENTS: "assessments",
  RESULTATS: "resultats",
  APPRENTISSAGES: "apprentissages",
  USER_PROFILES: "user_profiles",
} as const;

export const LEVEL_COLORS: Record<Level, string> = {
  TB: "#16a34a",
  B:  "#86efac",
  S:  "#fbbf24",
  I:  "#fb923c",
  NI: "#ef4444",
};

export const LEVEL_TEXT_COLORS: Record<Level, string> = {
  TB: "#ffffff",
  B:  "#14532d",
  S:  "#78350f",
  I:  "#7c2d12",
  NI: "#ffffff",
};

export const LEVEL_LABELS: Record<Level, string> = {
  TB: "Très bien",
  B:  "Bien",
  S:  "Suffisant",
  I:  "Insuffisant",
  NI: "Non initié",
};

export const ALL_LEVELS: Level[] = ["TB", "B", "S", "I", "NI"];

// ─── Context ──────────────────────────────────────────────────────────────────

export async function getTeacherContext(): Promise<TeacherContext> {
  const supabase = createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error("Pas connecté");

  const { data: mem, error: memErr } = await supabase
    .from(T.SCHOOL_MEMBERSHIPS)
    .select("school_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memErr) throw memErr;
  if (!mem?.school_id) throw new Error("École introuvable");

  const { data: ay, error: ayErr } = await supabase
    .from(T.ACADEMIC_YEARS)
    .select("id")
    .eq("school_id", mem.school_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ayErr) throw ayErr;
  if (!ay?.id) throw new Error("Année scolaire introuvable");

  return {
    supabase,
    schoolId: mem.school_id as UUID,
    teacherId: user.id as UUID,
    academicYearId: ay.id as UUID,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listClassGroups(ctx: TeacherContext): Promise<ClassGroup[]> {
  const { data, error } = await ctx.supabase
    .from(T.CLASS_GROUPS)
    .select("id,name,grade_level")
    .eq("school_id", ctx.schoolId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ClassGroup[];
}

export async function listStudentsForClass(
  ctx: TeacherContext,
  classGroupId: UUID
): Promise<Student[]> {
  const { data, error } = await ctx.supabase
    .from(T.STUDENT_ENROLLMENTS)
    .select("students(id,first_name,last_name)")
    .eq("class_group_id", classGroupId)
    .eq("academic_year_id", ctx.academicYearId);
  if (error) throw error;

  const students = (data ?? [])
    .map((row: any) => row.students)
    .filter(Boolean)
    .sort((a: Student, b: Student) =>
      a.last_name.localeCompare(b.last_name, "fr") ||
      a.first_name.localeCompare(b.first_name, "fr")
    );
  return students as Student[];
}

export async function listApprentissages(ctx: TeacherContext): Promise<Apprentissage[]> {
  const { data, error } = await ctx.supabase
    .from(T.APPRENTISSAGES)
    .select("id,name,order_index,active")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .order("order_index")
    .order("name");

  if (error) {
    const msg = String(error?.message ?? "").toLowerCase();
    if (
      msg.includes("apprentissages") &&
      (msg.includes("does not exist") || msg.includes("schema cache"))
    )
      return [];
    throw error;
  }
  return (data ?? []) as Apprentissage[];
}

export async function listAssessmentsForClass(
  ctx: TeacherContext,
  classGroupId: UUID,
  dateFrom?: string,
  dateTo?: string
): Promise<Assessment[]> {
  let q = ctx.supabase
    .from(T.ASSESSMENTS)
    .select("id,title,date,apprentissage_id,max_points")
    .eq("school_id", ctx.schoolId)
    .eq("class_group_id", classGroupId)
    .not("apprentissage_id", "is", null)
    .order("date", { ascending: true });

  if (dateFrom) q = (q as any).gte("date", dateFrom);
  if (dateTo)   q = (q as any).lte("date", dateTo);

  const { data, error } = await q;

  if (error) {
    const msg = String(error?.message ?? "").toLowerCase();
    if (
      msg.includes("apprentissage_id") &&
      (msg.includes("does not exist") || msg.includes("schema cache"))
    )
      return [];
    throw error;
  }
  return (data ?? []) as Assessment[];
}

export async function listResultatsForAssessments(
  ctx: TeacherContext,
  assessmentIds: UUID[]
): Promise<Resultat[]> {
  if (assessmentIds.length === 0) return [];
  const { data, error } = await ctx.supabase
    .from(T.RESULTATS)
    .select("student_id,assessment_id,level,value")
    .eq("school_id", ctx.schoolId)
    .in("assessment_id", assessmentIds);
  if (error) throw error;
  return (data ?? []) as Resultat[];
}

export async function getSchoolTemplate(
  supabase: ReturnType<typeof createClient>
): Promise<SchoolTemplate> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { school_name: "", teacher_name: "", address: "" };
  const { data } = await supabase
    .from(T.USER_PROFILES)
    .select("template_json,full_name")
    .eq("id", user.id)
    .maybeSingle();
  const saved = ((data?.template_json ?? {}) as Partial<SchoolTemplate>);
  return {
    school_name: saved.school_name ?? "",
    teacher_name: saved.teacher_name ?? (data?.full_name ?? ""),
    address: saved.address ?? "",
  };
}

// ─── Computation ──────────────────────────────────────────────────────────────

export function computeCompetenceGrid(
  students: Student[],
  apprentissages: Apprentissage[],
  assessments: Assessment[],
  resultats: Resultat[]
): CompetenceGrid {
  // Build lookup: (studentId, assessmentId) → Resultat
  const resultatMap = new Map<string, Resultat>();
  for (const r of resultats) {
    resultatMap.set(`${r.student_id}|${r.assessment_id}`, r);
  }

  const grid: CompetenceGrid = {};

  for (const app of apprentissages) {
    grid[app.id] = {};
    // Assessments for this apprentissage, sorted by date asc (already sorted)
    const appAssessments = assessments.filter((a) => a.apprentissage_id === app.id);

    for (const student of students) {
      // Most recent result with a level wins
      let latestLevel: Level | null = null;
      for (const assess of appAssessments) {
        const r = resultatMap.get(`${student.id}|${assess.id}`);
        if (r?.level) latestLevel = r.level;
      }
      grid[app.id][student.id] = latestLevel;
    }
  }

  return grid;
}

// How many students have a given level for a given apprentissage
export function countLevelsForApprentissage(
  grid: CompetenceGrid,
  apprentissageId: UUID,
  students: Student[]
): Record<Level | "none", number> {
  const counts: Record<Level | "none", number> = { TB: 0, B: 0, S: 0, I: 0, NI: 0, none: 0 };
  const row = grid[apprentissageId] ?? {};
  for (const s of students) {
    const level = row[s.id];
    if (level) counts[level]++;
    else counts.none++;
  }
  return counts;
}

"use client";

import { createClient } from "@/lib/supabase/client";

export type UUID = string;

export type TeacherContext = {
  supabase: ReturnType<typeof createClient>;
  schoolId: UUID;
  academicYearId: UUID;
};

export type Apprentissage = {
  id: UUID;
  name: string;
  order_index: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  APPRENTISSAGES: "apprentissages",
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

  const { data: ay, error: ayErr } = await supabase
    .from(T.ACADEMIC_YEARS)
    .select("id")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ayErr) throw ayErr;
  if (!ay?.id) throw new Error("Aucune année scolaire trouvée (academic_years).");

  return { supabase, schoolId, academicYearId: ay.id };
}

export async function listApprentissages(ctx: TeacherContext): Promise<Apprentissage[]> {
  const { data, error } = await ctx.supabase
    .from(T.APPRENTISSAGES)
    .select("id,name,order_index,active,created_at,updated_at")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .order("order_index", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Apprentissage[];
}

export async function createApprentissage(ctx: TeacherContext, params: { name: string }): Promise<Apprentissage> {
  const name = params.name.trim();
  if (!name) throw new Error("Nom obligatoire.");

  const { data: last, error: lastErr } = await ctx.supabase
    .from(T.APPRENTISSAGES)
    .select("order_index")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastErr) throw lastErr;

  const nextOrder = (last?.order_index ?? -1) + 1;

  const { data, error } = await ctx.supabase
    .from(T.APPRENTISSAGES)
    .insert({
      school_id: ctx.schoolId,
      academic_year_id: ctx.academicYearId,
      name,
      order_index: nextOrder,
      active: true,
    })
    .select("id,name,order_index,active,created_at,updated_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Création échouée (pas de retour).");

  return data as Apprentissage;
}

export async function updateApprentissage(
  ctx: TeacherContext,
  params: { apprentissageId: UUID; patch: Partial<Pick<Apprentissage, "name" | "active">> }
): Promise<Apprentissage> {
  const { apprentissageId, patch } = params;

  const payload: { name?: string; active?: boolean } = {};

  if (typeof patch.name === "string") {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error("Nom obligatoire.");
    payload.name = trimmed;
  }

  if (typeof patch.active === "boolean") payload.active = patch.active;

  const { data, error } = await ctx.supabase
    .from(T.APPRENTISSAGES)
    .update(payload)
    .eq("id", apprentissageId)
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .select("id,name,order_index,active,created_at,updated_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Mise à jour échouée (pas de retour).");

  return data as Apprentissage;
}

export async function reorderApprentissages(
  ctx: TeacherContext,
  params: {
    firstId: UUID;
    firstOrder: number;
    secondId: UUID;
    secondOrder: number;
  }
): Promise<void> {
  const { firstId, firstOrder, secondId, secondOrder } = params;

  const { error: firstErr } = await ctx.supabase
    .from(T.APPRENTISSAGES)
    .update({ order_index: secondOrder })
    .eq("id", firstId)
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId);

  if (firstErr) throw firstErr;

  const { error: secondErr } = await ctx.supabase
    .from(T.APPRENTISSAGES)
    .update({ order_index: firstOrder })
    .eq("id", secondId)
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId);

  if (secondErr) throw secondErr;
}

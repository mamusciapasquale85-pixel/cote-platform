// src/app/api/planification/sources/route.ts
// CRUD sur les sources de planification

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data, error } = await supabase
    .from("planification_sources")
    .select("*")
    .eq("teacher_id", user.id)
    .eq("is_active", true)
    .order("academic_year", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { name, academic_year, source_type, config, color } = body;

  // Récupérer le school_id depuis une source existante (plus fiable que school_memberships avec RLS)
  let schoolId: string | null = null;

  const { data: existingSource } = await supabase
    .from("planification_sources")
    .select("school_id")
    .eq("teacher_id", user.id)
    .limit(1)
    .single();

  if (existingSource) {
    schoolId = existingSource.school_id;
  } else {
    // Fallback : school_memberships
    const { data: membership } = await supabase
      .from("school_memberships")
      .select("school_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    schoolId = membership?.school_id ?? null;
  }

  if (!schoolId) return NextResponse.json({ error: "École introuvable" }, { status: 400 });

  const { data, error } = await supabase
    .from("planification_sources")
    .insert({ school_id: schoolId, teacher_id: user.id, name, academic_year, source_type, config, color: color ?? "#6366F1" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });

  const { error } = await supabase
    .from("planification_sources")
    .update({ is_active: false })
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

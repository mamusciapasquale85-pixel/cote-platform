import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GridQuestion } from "../correct/route";

export const runtime = "nodejs";

// ─── GET : charger la grille d'une évaluation ─────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const assessmentId = searchParams.get("assessment_id");
  if (!assessmentId) return NextResponse.json({ error: "assessment_id requis" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluation_grids")
    .select("id, questions")
    .eq("assessment_id", assessmentId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ questions: (data?.questions ?? []) as GridQuestion[], grid_id: data?.id ?? null });
}

// ─── POST : upsert la grille ──────────────────────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = (await req.json()) as { assessment_id: string; questions: GridQuestion[] };
  if (!body.assessment_id || !Array.isArray(body.questions)) {
    return NextResponse.json({ error: "assessment_id + questions requis" }, { status: 400 });
  }

  // Récupérer school_id depuis l'assessment
  const { data: ass } = await supabase
    .from("assessments")
    .select("school_id")
    .eq("id", body.assessment_id)
    .maybeSingle();

  const { error } = await supabase
    .from("evaluation_grids")
    .upsert({
      assessment_id: body.assessment_id,
      school_id: ass?.school_id ?? "",
      questions: body.questions,
      updated_at: new Date().toISOString(),
    }, { onConflict: "assessment_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

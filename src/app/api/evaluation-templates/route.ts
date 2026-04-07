import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ─── GET : lister les modèles de l'utilisateur connecté ──────────────────────
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data, error } = await supabase
    .from("evaluation_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

// ─── POST : créer un modèle ───────────────────────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json() as {
    titre: string; type: string; matiere: string; competence?: string;
    niveau?: string; type_exercice?: string; points_max?: number;
    cotation_type?: string; fichier_path?: string; fichier_nom?: string;
    grille?: unknown; instructions?: string; school_id?: string;
  };

  if (!body.titre?.trim()) return NextResponse.json({ error: "titre requis" }, { status: 400 });

  const { data, error } = await supabase
    .from("evaluation_templates")
    .insert({
      user_id: user.id,
      school_id: body.school_id ?? null,
      titre: body.titre.trim(),
      type: body.type ?? "formative",
      matiere: body.matiere ?? "nl",
      competence: body.competence ?? null,
      niveau: body.niveau ?? "A1",
      type_exercice: body.type_exercice ?? "flashcards",
      points_max: body.points_max ?? 20,
      cotation_type: body.cotation_type ?? "points",
      fichier_path: body.fichier_path ?? null,
      fichier_nom: body.fichier_nom ?? null,
      grille: body.grille ?? null,
      instructions: body.instructions ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

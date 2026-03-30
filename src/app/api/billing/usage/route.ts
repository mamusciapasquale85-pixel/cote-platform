import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getExerciceUsageSummary } from "@/lib/billing";

export const runtime = "nodejs";

// Retourne l'usage du mois en cours pour l'affichage dans le dashboard
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const summary = await getExerciceUsageSummary(supabase, user.id);
    return NextResponse.json(summary);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

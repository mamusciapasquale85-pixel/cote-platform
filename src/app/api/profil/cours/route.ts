import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ cours: [], matiere: null }, { status: 401 });

    // Trouver l'école du prof
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mem } = await (supabase as any)
      .from("school_memberships")
      .select("school_id, matiere")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!mem?.school_id) return NextResponse.json({ cours: [], matiere: null });

    // Récupérer tous les cours de l'école
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: courses } = await (supabase as any)
      .from("courses")
      .select("id, name")
      .eq("school_id", mem.school_id)
      .order("name", { ascending: true });

    const cours: { id: string; name: string }[] = courses ?? [];

    return NextResponse.json({ cours, matiere: mem.matiere ?? null });
  } catch {
    return NextResponse.json({ cours: [], matiere: null });
  }
}

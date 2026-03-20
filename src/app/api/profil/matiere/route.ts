import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ matiere: null }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("school_memberships")
      .select("matiere")
      .eq("user_id", user.id)
      .not("matiere", "is", null)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ matiere: data?.matiere ?? "votre matière" });
  } catch {
    return NextResponse.json({ matiere: "votre matière" });
  }
}

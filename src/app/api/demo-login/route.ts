import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { target } = await req.json();

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const userId =
    target === "direction"
      ? "00000000-0000-0000-0000-000000000002"
      : "00000000-0000-0000-0000-000000000001";

  const { data, error } = await supabaseAdmin.auth.admin.createSession(userId);

  if (error || !data.session) {
    return NextResponse.json({ error: error?.message || "Erreur session" }, { status: 500 });
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}

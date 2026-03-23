import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("token") !== "klasbook-init-2025") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const DEMO_ID = "00000000-0000-0000-0000-000000000001";

  // Mettre à jour le mot de passe via l'API admin (hash bcrypt correct)
  const { error } = await supabaseAdmin.auth.admin.updateUserById(DEMO_ID, {
    password: "KlasbookDemo2025!",
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Mot de passe démo mis à jour" });
}

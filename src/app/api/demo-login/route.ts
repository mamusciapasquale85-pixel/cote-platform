import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { target } = await req.json();

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const email =
    target === "direction" ? "direction@klasbook.be" : "demo@klasbook.be";

  const redirectTo = `https://www.klasbook.be/${target}`;

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ error: error?.message || "Erreur génération lien" }, { status: 500 });
  }

  return NextResponse.json({ action_link: data.properties.action_link });
}

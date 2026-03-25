import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const DEMO_EMAILS: Record<string, string> = {
  prof:      "demo@klasbook.be",
  direction: "direction@klasbook.be",
  parents:   "parent@klasbook.be",
};

export async function GET(req: NextRequest) {
  const role   = req.nextUrl.searchParams.get("role") || "prof";
  const origin = req.nextUrl.origin;
  const email  = DEMO_EMAILS[role] ?? DEMO_EMAILS.prof;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data?.properties?.action_link) {
    console.error("Demo generateLink error:", error?.message, "role:", role);
    return NextResponse.redirect(`${origin}/login?error=demo`);
  }

  return NextResponse.redirect(data.properties.action_link);
}

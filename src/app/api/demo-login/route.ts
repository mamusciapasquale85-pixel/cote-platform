import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const DEMO_USERS: Record<string, { id: string; email: string; password: string }> = {
  dashboard: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "demo@klasbook.be",
    password: process.env.DEMO_PASSWORD_PROF || "KlasbookDemo2025!",
  },
  direction: {
    id: "00000000-0000-0000-0000-000000000002",
    email: "direction@klasbook.be",
    password: process.env.DEMO_PASSWORD_DIR || "KlasbookDir2025!",
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const target = searchParams.get("target") || "dashboard";
  const origin = req.nextUrl.origin;
  const user = DEMO_USERS[target] ?? DEMO_USERS.dashboard;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Forcer le mot de passe connu (idempotent, pas de race condition)
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { password: user.password }
  );
  if (updateError) {
    return NextResponse.redirect(`${origin}/login?error=demo`);
  }

  // 2. Se connecter — set les cookies SSR dans la réponse
  const response = NextResponse.redirect(`${origin}/${target}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (signInError) {
    console.error("Demo signIn error:", signInError.message, "target:", target);
    return NextResponse.redirect(`${origin}/login?error=demo`);
  }

  return response;
}

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const DEMO_USERS: Record<string, { email: string; password: string }> = {
  dashboard: {
    email: "demo@klasbook.be",
    password: process.env.DEMO_PASSWORD_PROF || "KlasbookDemo2025!",
  },
  direction: {
    email: "direction@klasbook.be",
    password: process.env.DEMO_PASSWORD_DIR || "KlasbookDir2025!",
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const target = searchParams.get("target") || "dashboard";
  const origin = req.nextUrl.origin;
  const user = DEMO_USERS[target] ?? DEMO_USERS.dashboard;

  // Se connecter directement — mot de passe fixé en DB via migration SQL
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

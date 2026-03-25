import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const DEMO_USERS: Record<string, { id: string; email: string }> = {
  dashboard: { id: "00000000-0000-0000-0000-000000000001", email: "demo@klasbook.be" },
  direction: { id: "00000000-0000-0000-0000-000000000002", email: "direction@klasbook.be" },
};

// Mot de passe éphémère — changé à chaque requête, jamais exposé au client
const TEMP_PASS = `Demo_${Date.now()}_Kls!`;

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

  // 1. Mettre à jour le mot de passe via admin (contourne generateLink)
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { password: TEMP_PASS }
  );
  if (updateError) {
    return NextResponse.redirect(`${origin}/login?error=demo`);
  }

  // 2. Se connecter avec ce mot de passe — set les cookies SSR dans la réponse
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
    password: TEMP_PASS,
  });

  if (signInError) {
    return NextResponse.redirect(`${origin}/login?error=demo`);
  }

  return response;
}

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const DEMO_USERS: Record<string, { email: string; target: string }> = {
  prof:      { email: "demo@klasbook.be",      target: "dashboard"  },
  direction: { email: "direction@klasbook.be", target: "direction"  },
  parents:   { email: "parent@klasbook.be",    target: "parent"     },
};

const DEMO_PASSWORD = "KlasbookDemo2025!";

export async function GET(req: NextRequest) {
  const role   = req.nextUrl.searchParams.get("role") || "prof";
  const origin = req.nextUrl.origin;
  const demo   = DEMO_USERS[role] ?? DEMO_USERS.prof;

  const response = NextResponse.redirect(`${origin}/${demo.target}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: demo.email,
    password: DEMO_PASSWORD,
  });

  if (error) {
    console.error("Demo signIn error:", error.message, "role:", role);
    return NextResponse.redirect(`${origin}/login?error=demo`);
  }

  return response;
}

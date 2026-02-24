import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  // Si pas de code, on renvoie au login
  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Vérifie les variables d'env (sinon ça crash -> 500)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/login?error=missing_env`);
  }

  // On prépare la redirection finale
  const response = NextResponse.redirect(`${origin}/teacher`);

  // Supabase SSR client (cookies)
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // Si échange session échoue -> retour login
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  return response;
}

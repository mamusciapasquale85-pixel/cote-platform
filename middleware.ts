import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/teacher", "/parent", "/admin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1) Toujours mettre à jour la session (cookies Supabase)
  const response = await updateSession(request);

  // 2) Protéger certaines routes
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-"));

    if (!hasAuthCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/login"; // doit exister => src/app/login/page.tsx
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

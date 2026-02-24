import { NextResponse, type NextRequest } from "next/server";

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  // Supabase met des cookies qui commencent souvent par "sb-"
  const cookies = request.cookies.getAll();

  for (const c of cookies) {
    if (c.name.startsWith("sb-")) {
      response.cookies.set({
        name: c.name,
        value: "",
        path: "/",
        expires: new Date(0),
      });
    }
  }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));

  clearSupabaseCookies(request, response);

  return response;
}

// Si jamais ton bouton envoie POST, on gère aussi POST
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));

  clearSupabaseCookies(request, response);

  return response;
}
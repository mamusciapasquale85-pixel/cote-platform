// app/api/eleves/[id]/contacts/route.ts
// PATCH — met à jour l'email élève et/ou email parent

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Vérifie que le prof est connecté
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json() as { email?: string; parent_email?: string; student_ref?: string; parent_phone?: string };
  const updates: Record<string, string | null> = {};

  if ("email" in body) updates.email = body.email?.trim() || null;
  if ("parent_email" in body) updates.parent_email = body.parent_email?.trim() || null;
  if ("student_ref" in body) updates.student_ref = body.student_ref?.trim() || null;
  if ("parent_phone" in body) updates.parent_phone = body.parent_phone?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
  }

  const { error } = await admin
    .from("students")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

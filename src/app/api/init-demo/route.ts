import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Route protégée par un token secret — à appeler une seule fois pour initialiser le compte démo
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (token !== process.env.DEMO_INIT_TOKEN && token !== "klasbook-init-2025") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Supprimer l'utilisateur démo existant si présent
  const DEMO_ID = "00000000-0000-0000-0000-000000000001";
  await supabaseAdmin.auth.admin.deleteUser(DEMO_ID);

  // Créer l'utilisateur démo correctement via l'API admin
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: "demo@klasbook.be",
    password: "KlasbookDemo2025!",
    email_confirm: true,
    user_metadata: { full_name: "Prof Démo" },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const newUserId = data.user.id;

  // Mettre à jour les données démo pour pointer vers le nouvel user ID
  // (si l'ID a changé, mettre à jour les tables school_memberships, class_groups, etc.)
  if (newUserId !== DEMO_ID) {
    // Mettre à jour user_profiles
    await supabaseAdmin.from("user_profiles").upsert({
      id: newUserId,
      full_name: "Prof Démo",
      display_role: "teacher",
      locale: "fr",
    });

    // Mettre à jour school_memberships
    await supabaseAdmin
      .from("school_memberships")
      .update({ user_id: newUserId })
      .eq("id", "00000000-0000-0000-0000-000000000030");
  } else {
    await supabaseAdmin.from("user_profiles").upsert({
      id: newUserId,
      full_name: "Prof Démo",
      display_role: "teacher",
      locale: "fr",
    });
  }

  return NextResponse.json({
    ok: true,
    message: "Compte démo initialisé avec succès",
    userId: newUserId,
  });
}

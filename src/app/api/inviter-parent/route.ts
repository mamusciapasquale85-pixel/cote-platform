import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, student_id, student_name } = await req.json() as {
      email: string;
      student_id: string;
      student_name: string;
    };

    if (!email || !student_id) {
      return NextResponse.json({ error: "email et student_id requis" }, { status: 400 });
    }

    // Client enseignant — vérifier que c'est bien un prof connecté
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    // Récupérer school_id du prof
    const { data: mem } = await supabase
      .from("school_memberships")
      .select("school_id, role")
      .eq("user_id", user.id)
      .in("role", ["teacher", "admin"])
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (!mem) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    const schoolId = mem.school_id;

    // Admin client (service role) pour créer/inviter l'utilisateur
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Vérifier si un compte avec cet email existe déjà
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let parentUserId: string;

    if (existingUser) {
      parentUserId = existingUser.id;
    } else {
      // Inviter l'utilisateur (Supabase envoie un email magique)
      const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { role: "parent", school_id: schoolId },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://klasbook.be"}/accept-invitation`,
      });
      if (inviteErr) throw inviteErr;
      parentUserId = invited.user.id;
    }

    // Ajouter à school_memberships avec rôle parent
    const { error: memErr } = await adminClient
      .from("school_memberships")
      .upsert({ school_id: schoolId, user_id: parentUserId, role: "parent" }, { onConflict: "school_id,user_id" });
    if (memErr) throw memErr;

    // Créer le lien parent → élève
    const { error: linkErr } = await adminClient
      .from("parent_links")
      .upsert({ school_id: schoolId, parent_user_id: parentUserId, student_id, relationship: "parent" }, { onConflict: "parent_user_id,student_id" });
    if (linkErr) throw linkErr;

    return NextResponse.json({
      success: true,
      message: existingUser
        ? `${email} lié à ${student_name}. Le compte existait déjà.`
        : `Invitation envoyée à ${email} pour ${student_name}.`,
    });

  } catch (e: any) {
    console.error("inviter-parent error:", e);
    return NextResponse.json({ error: e.message ?? "Erreur inconnue" }, { status: 500 });
  }
}

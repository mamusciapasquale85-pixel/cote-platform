import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { studentId, evaluationTitle, level, value, maxPoints } = await req.json();
    if (!studentId) return NextResponse.json({ error: "studentId requis" }, { status: 400 });

    const supabase = await createSupabaseServerClient();

    // Vérif auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    // Récupérer l'élève
    const { data: student } = await supabase
      .from("students")
      .select("first_name, last_name")
      .eq("id", studentId)
      .maybeSingle();

    if (!student) return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });

    // Récupérer les parents liés
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("parent_user_id")
      .eq("student_id", studentId);

    if (!links || links.length === 0) {
      return NextResponse.json({ sent: 0, message: "Aucun parent lié" });
    }

    const parentIds = links.map((l: { parent_user_id: string }) => l.parent_user_id);

    // Récupérer les emails parents via service role
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const parentEmails: string[] = [];
    for (const pid of parentIds) {
      const { data: userData } = await adminClient.auth.admin.getUserById(pid);
      if (userData?.user?.email) parentEmails.push(userData.user.email);
    }

    if (parentEmails.length === 0) {
      return NextResponse.json({ sent: 0, message: "Emails parents introuvables" });
    }

    // Construire le résultat affiché
    const resultStr = level
      ? `Niveau : **${level}**`
      : value != null && maxPoints != null
      ? `Note : **${value}/${maxPoints}**`
      : "";

    const eleveName = `${student.first_name} ${student.last_name}`;

    // Envoi via Resend (si configuré)
    const resendKey = process.env.RESEND_API_KEY;
    let sent = 0;

    if (resendKey) {
      for (const email of parentEmails) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Klasbook <noreply@klasbook.be>",
            to: [email],
            subject: `Nouveau résultat pour ${eleveName}`,
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                <div style="background: linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%); border-radius: 12px; padding: 20px 24px; color: white; margin-bottom: 24px;">
                  <div style="font-size: 22px; font-weight: 900;">📊 Klasbook</div>
                  <div style="opacity: .85; font-size: 14px; margin-top: 4px;">Nouveau résultat enregistré</div>
                </div>
                <p style="font-size: 16px; color: #0f172a;">Bonjour,</p>
                <p style="color: #334155;">Un nouveau résultat a été enregistré pour <strong>${eleveName}</strong> :</p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin: 16px 0;">
                  <div style="font-weight: 700; color: #0f172a; margin-bottom: 6px;">📝 ${evaluationTitle || "Évaluation"}</div>
                  <div style="color: #475569;">${resultStr.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</div>
                </div>
                <p style="color: #64748b; font-size: 13px;">Connectez-vous sur <a href="https://klasbook.be/parent" style="color: #0A84FF;">klasbook.be</a> pour voir le détail des résultats.</p>
                <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 11px;">Klasbook · Fédération Wallonie-Bruxelles · klasbook.be</p>
              </div>
            `,
          }),
        });
        if (res.ok) sent++;
      }
    } else {
      // Fallback log si Resend non configuré
      console.log(`[notify-parent] Résultat pour ${eleveName} — parents: ${parentEmails.join(", ")} — ${resultStr}`);
      sent = parentEmails.length;
    }

    return NextResponse.json({ sent, emails: parentEmails.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

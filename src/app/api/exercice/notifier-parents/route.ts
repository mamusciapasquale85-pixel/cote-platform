// app/api/exercice/notifier-parents/route.ts
// Envoie un rappel email aux parents pour les exercices non faits avant la deadline
// Appelable par cron (Vercel Cron, n8n, etc.) ou manuellement par le prof

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function buildEmailParentHtml(params: {
  eleveNom: string;
  classeNom: string;
  exerciceTitre: string;
  deadline: string;
  lienExercice: string;
}): string {
  const { eleveNom, classeNom, exerciceTitre, deadline, lienExercice } = params;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.12);">

    <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:22px 28px;">
      <div style="color:#fff;font-size:20px;font-weight:900;">✦ Klasbook</div>
      <div style="color:rgba(255,255,255,0.85);font-size:12px;margin-top:3px;">Message de l'établissement scolaire</div>
    </div>

    <div style="padding:28px;">
      <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:16px;">Bonjour,</div>

      <div style="font-size:14px;color:#334155;line-height:1.7;margin-bottom:20px;">
        Votre enfant <strong>${eleveNom}</strong> (classe <strong>${classeNom}</strong>) a reçu un exercice de remédiation
        qui n'a pas encore été complété.<br/><br/>
        Nous vous invitons à l'encourager à le faire avant le <strong>${deadline}</strong>.
      </div>

      <div style="padding:16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:24px;">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Exercice concerné</div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;">📚 ${exerciceTitre}</div>
      </div>

      <a href="${lienExercice}"
         style="display:block;text-align:center;padding:14px;border-radius:12px;background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);color:#fff;font-weight:800;font-size:14px;text-decoration:none;">
        ✏️ Accéder à l'exercice →
      </a>

      <div style="margin-top:20px;font-size:12px;color:#94a3b8;text-align:center;">
        L'exercice peut être fait sur téléphone ou ordinateur, sans créer de compte.<br/>
        En cas de question, contactez directement le professeur.
      </div>
    </div>

    <div style="padding:14px 28px;text-align:center;border-top:1px solid #f1f5f9;">
      <div style="font-size:11px;color:#94a3b8;">© ${new Date().getFullYear()} Klasbook · klasbook.be</div>
    </div>
  </div>
</body>
</html>`;
}

// ─── POST — Envoyer rappels parents ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Vercel Cron envoie automatiquement Authorization: Bearer CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { exercice_id?: string };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://klasbook.be";

  // Récupère les exercices non faits dont la deadline est passée ou dans moins de 24h
  // Si un ID spécifique est fourni, n'envoie que pour celui-là
  let query = supabase
    .from("exercices_envoyes")
    .select("id, token, titre, eleve_nom, classe_nom, eleve_id, deadline, rappel_parents_envoye")
    .eq("statut", "en_attente")
    .eq("rappel_parents_envoye", false)
    .not("token", "is", null);

  if (body.exercice_id) {
    query = query.eq("id", body.exercice_id);
  } else {
    // Exercices dont la deadline est dans moins de 24h ou déjà passée
    const seuil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    query = query.lte("deadline", seuil).not("deadline", "is", null);
  }

  const { data: exercices, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!exercices || exercices.length === 0) {
    return NextResponse.json({ ok: true, envoyes: 0, message: "Aucun rappel à envoyer" });
  }

  let envoyes = 0;
  const erreurs: string[] = [];

  for (const ex of exercices) {
    // Récupère l'email du parent
    const { data: student } = await supabase
      .from("students")
      .select("parent_email")
      .eq("id", ex.eleve_id)
      .single();

    const parentEmail = student?.parent_email as string | null | undefined;
    if (!parentEmail) continue;

    const deadline = ex.deadline
      ? new Date(ex.deadline as string).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })
      : "bientôt";

    const lienExercice = `${appUrl}/exercice/${ex.token}`;

    const html = buildEmailParentHtml({
      eleveNom: ex.eleve_nom as string,
      classeNom: ex.classe_nom as string,
      exerciceTitre: ex.titre as string,
      deadline,
      lienExercice,
    });

    try {
      await resend.emails.send({
        from: "Klasbook <noreply@klasbook.be>",
        to: [parentEmail],
        subject: `📚 Rappel : exercice de remédiation non complété — ${ex.eleve_nom}`,
        html,
      });

      // Marque comme envoyé
      await supabase
        .from("exercices_envoyes")
        .update({ rappel_parents_envoye: true, rappel_envoye_at: new Date().toISOString() })
        .eq("id", ex.id);

      envoyes++;
    } catch (e: unknown) {
      erreurs.push(`${ex.eleve_nom}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, envoyes, erreurs: erreurs.length > 0 ? erreurs : undefined });
}

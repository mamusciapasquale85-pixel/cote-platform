// app/api/remediations/envoyer-exercice/route.ts
// Envoie l'exercice généré par email à l'élève (Resend) + sauvegarde historique prof

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Calcul année scolaire ────────────────────────────────────────────────────

function getAnneeScolaire(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  // Année scolaire : septembre = début de la nouvelle année
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// ─── Template email HTML ──────────────────────────────────────────────────────

function buildEmailHtml(params: {
  eleveNom: string;
  titre: string;
  contenu: string;
  classeNom: string;
  profNom: string;
  date: string;
  lienExercice?: string;
}): string {
  const { eleveNom, titre, contenu, classeNom, profNom, date, lienExercice } = params;

  // Convertit le texte brut en HTML simple
  const contentHtml = contenu
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return "<br/>";
      if (/^[A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ][A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ\s:–\-]{5,}$/.test(t) || /^#{1,3}\s/.test(t)) {
        const text = t.replace(/^#+\s/, "");
        return `<div style="font-weight:900;font-size:13px;color:#0A84FF;margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid rgba(10,132,255,0.2);padding-bottom:4px;">${text}</div>`;
      }
      if (/^(corrig[eé]|réponses?|CORRIGÉ)/i.test(t)) {
        return `<div style="font-weight:800;color:#15803D;margin:14px 0 6px;padding:6px 12px;background:rgba(34,197,94,0.08);border-radius:8px;border-left:3px solid #22c55e;">✅ ${t}</div>`;
      }
      if (/^(\d+[.):]|[A-Z][.):]|[-•*])\s/.test(t)) {
        return `<div style="padding:3px 0 3px 16px;border-left:3px solid #e2e8f0;margin-bottom:3px;color:#334155;">${t}</div>`;
      }
      return `<div style="color:#374151;margin-bottom:2px;">${t}</div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${titre}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.12);">

    <!-- HEADER KLASBOOK -->
    <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:24px 28px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.02em;">✦ Klasbook</div>
        <div style="color:rgba(255,255,255,0.85);font-size:12px;margin-top:2px;">La gestion de classe simplifiée</div>
      </div>
      <div style="text-align:right;">
        <div style="color:#ffffff;font-size:12px;opacity:0.85;">${date}</div>
        <div style="color:#ffffff;font-size:12px;margin-top:2px;opacity:0.85;">${classeNom}</div>
      </div>
    </div>

    <!-- INTRO -->
    <div style="padding:24px 28px 0;">
      <div style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.02em;">${titre}</div>
      <div style="margin-top:10px;padding:12px 16px;background:rgba(10,132,255,0.06);border-radius:12px;border:1px solid rgba(10,132,255,0.18);">
        <div style="font-size:13px;color:#475569;">
          👤 <strong>${eleveNom}</strong> · 🏫 ${classeNom} · 👨‍🏫 ${profNom}
        </div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Exercice de remédiation généré par l'IA Klasbook</div>
      </div>
    </div>

    <!-- SÉPARATEUR -->
    <div style="margin:20px 28px;height:1px;background:rgba(15,23,42,0.08);"></div>

    <!-- CONTENU EXERCICE -->
    <div style="padding:0 28px;font-size:13px;line-height:1.8;color:#1e293b;">
      ${contentHtml}
    </div>

    <!-- BOUTON FAIRE L'EXERCICE EN LIGNE -->
    ${lienExercice ? `<div style="margin:24px 28px 0;text-align:center;">
      <a href="${lienExercice}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);color:#fff;font-weight:800;font-size:15px;text-decoration:none;box-shadow:0 4px 16px rgba(10,132,255,0.3);">✏️ Faire l'exercice en ligne →</a>
      <div style="font-size:12px;color:#94a3b8;margin-top:8px;">Sur téléphone ou ordinateur · Aucun compte requis</div>
    </div>` : ""}

    <!-- FOOTER -->
    <div style="margin:28px 28px 0;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid rgba(15,23,42,0.06);">
      <div style="font-size:12px;color:#64748b;">
        📚 Cet exercice a été généré automatiquement par <strong>Klasbook</strong> à la demande de ton professeur.<br/>
        Réponds directement à cet email si tu as des questions.
      </div>
    </div>

    <div style="padding:16px 28px;text-align:center;">
      <div style="font-size:11px;color:#94a3b8;">© ${new Date().getFullYear()} Klasbook · klasbook.be</div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Handler POST ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const {
      remediationId,
      eleveId,
      eleveNom,
      classeId,
      classeNom,
      titre,
      contenu,
      profId,
      profNom,
    } = await req.json() as {
      remediationId: string;
      eleveId: string;
      eleveNom: string;
      classeId: string;
      classeNom: string;
      titre: string;
      contenu: string;
      profId: string;
      profNom: string;
    };

    if (!eleveId || !titre || !contenu) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const anneeScolaire = getAnneeScolaire();
    const dateStr = new Date().toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://klasbook.be";

    // ── Génère un token unique pour la page interactive ──
    const token = crypto.randomUUID();
    // Deadline : 7 jours par défaut
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const lienExercice = `${appUrl}/exercice/${token}`;

    // ── Récupère l'email de l'élève et du parent ──
    const { data: eleveData } = await supabase
      .from("students")
      .select("email, parent_email")
      .eq("id", eleveId)
      .single();

    const emailEleve = eleveData?.email as string | null | undefined;
    const emailParent = eleveData?.parent_email as string | null | undefined;

    // ── Sauvegarde dans l'historique ──
    const { data: historique, error: dbError } = await supabase
      .from("exercices_envoyes")
      .insert({
        remediation_id: remediationId || null,
        prof_id: profId || null,
        eleve_id: eleveId,
        classe_id: classeId || null,
        annee_scolaire: anneeScolaire,
        classe_nom: classeNom,
        eleve_nom: eleveNom,
        titre,
        contenu,
        email_destinataire: emailEleve || null,
        email_envoye: false,
        token,
        deadline,
        statut: "en_attente",
      })
      .select("id")
      .single();

    if (dbError) {
      console.warn("[envoyer-exercice] Erreur sauvegarde historique :", dbError.message);
    }

    // ── Envoi email élève + parent ──
    let emailEnvoye = false;
    let emailErreur: string | null = null;
    let parentEmailEnvoye = false;
    let parentEmailErreur: string | null = null;

    const buildHtml = () => buildEmailHtml({
      eleveNom, titre, contenu, classeNom, lienExercice,
      profNom: profNom || "Votre professeur", date: dateStr,
    });

    // Envoi à l'élève
    if (emailEleve) {
      try {
        await resend.emails.send({
          from: "Klasbook <noreply@klasbook.be>",
          to: [emailEleve],
          subject: `📚 Exercice de remédiation : ${titre}`,
          html: buildHtml(),
        });
        emailEnvoye = true;
        if (historique?.id) {
          await supabase.from("exercices_envoyes")
            .update({ email_envoye: true, envoye_at: new Date().toISOString() })
            .eq("id", historique.id);
        }
      } catch (emailErr) {
        console.error("[envoyer-exercice] Erreur Resend élève :", emailErr);
        emailErreur = emailErr instanceof Error ? emailErr.message : "Erreur envoi email élève";
      }
    }

    // Envoi au parent
    if (emailParent) {
      try {
        await resend.emails.send({
          from: "Klasbook <noreply@klasbook.be>",
          to: [emailParent],
          subject: `📚 Remédiation de ${eleveNom} : ${titre}`,
          html: buildHtml(),
        });
        parentEmailEnvoye = true;
      } catch (parentErr) {
        console.error("[envoyer-exercice] Erreur Resend parent :", parentErr);
        parentEmailErreur = parentErr instanceof Error ? parentErr.message : "Erreur envoi email parent";
      }
    }

    return NextResponse.json({
      ok: true,
      sauvegardeId: historique?.id ?? null,
      emailEnvoye,
      emailDestinataire: emailEleve || null,
      emailErreur,
      parentEmailEnvoye,
      parentEmailDestinataire: emailParent || null,
      parentEmailErreur,
      anneeScolaire,
      lienExercice,
      token,
    });
  } catch (err) {
    console.error("[envoyer-exercice] Erreur :", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

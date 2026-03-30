// ─── Client Resend ──────────────────────────────────────────────────────────
// Variable d'environnement requise : RESEND_API_KEY=re_...
// À obtenir sur : https://resend.com (plan gratuit = 3 000 emails/mois)
// Domaine expéditeur : configurez noreply@klasbook.be dans le dashboard Resend

import { Resend } from "resend";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY manquante dans .env.local");
  return new Resend(key);
}

const FROM = "Klasbook <noreply@klasbook.be>";

// ─── Types ──────────────────────────────────────────────────────────────────

type SendResult = { success: boolean; error?: string };

// ─── Templates HTML ─────────────────────────────────────────────────────────

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Klasbook</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <!-- Logo -->
        <tr><td style="padding-bottom:24px;text-align:center">
          <div style="display:inline-flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);display:inline-block;text-align:center;line-height:36px;font-size:18px;color:#fff">✦</div>
            <span style="font-weight:900;font-size:18px;color:#0f172a">Klasbook</span>
          </div>
        </td></tr>
        <!-- Content -->
        <tr><td style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px;text-align:center;font-size:11px;color:#94a3b8">
          Klasbook · La gestion de classe simplifiée pour la FWB<br>
          <a href="https://klasbook.be/vie-privee" style="color:#94a3b8">Politique de confidentialité</a> ·
          <a href="https://klasbook.be/cgu" style="color:#94a3b8">CGU</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email de bienvenue ──────────────────────────────────────────────────────

export async function sendWelcomeEmail(params: {
  to: string;
  firstName: string;
}): Promise<SendResult> {
  try {
    const resend = getResend();
    const { to, firstName } = params;

    const html = baseLayout(`
      <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:28px 32px">
        <div style="font-size:24px;font-weight:900;color:#fff">Bienvenue sur Klasbook ! 🎉</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">Ta plateforme pédagogique FWB</div>
      </div>
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#0f172a;margin:0 0 16px">Bonjour ${firstName},</p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px">
          Ton compte Klasbook est prêt. Tu peux dès maintenant générer des exercices IA conformes
          aux référentiels officiels FWB, créer des évaluations avec ton canevas école,
          et utiliser l'Inspecteur FWB comme assistant pédagogique.
        </p>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 24px">
          Avec le plan gratuit, tu as accès à <strong>10 générations d'exercices par mois</strong>.
          Passe au plan Pro pour un accès illimité.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="https://klasbook.be/dashboard"
             style="display:inline-block;padding:13px 32px;border-radius:12px;
                    background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);
                    color:#fff;font-weight:800;font-size:14px;text-decoration:none">
            Accéder à mon tableau de bord →
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="font-size:12px;color:#94a3b8;margin:0">
          Une question ? Réponds directement à cet email ou écris à
          <a href="mailto:support@klasbook.be" style="color:#0A84FF">support@klasbook.be</a>
        </p>
      </div>
    `);

    await resend.emails.send({
      from: FROM,
      to,
      subject: "Bienvenue sur Klasbook 🎉",
      html,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ─── Email d'invitation parent ────────────────────────────────────────────

export async function sendParentInvitationEmail(params: {
  to: string;
  parentName?: string;
  studentName: string;
  teacherName: string;
  schoolName: string;
  invitationLink: string;
}): Promise<SendResult> {
  try {
    const resend = getResend();
    const { to, parentName, studentName, teacherName, schoolName, invitationLink } = params;

    const html = baseLayout(`
      <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:28px 32px">
        <div style="font-size:20px;font-weight:900;color:#fff">Invitation au portail parents 👨‍👩‍👧</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">${schoolName}</div>
      </div>
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#0f172a;margin:0 0 16px">
          ${parentName ? `Bonjour ${parentName},` : "Bonjour,"}
        </p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px">
          <strong>${teacherName}</strong> vous invite à suivre les résultats et l'évolution
          scolaire de <strong>${studentName}</strong> via le portail parents Klasbook.
        </p>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 24px">
          Vous pourrez consulter les résultats des évaluations, le bulletin de compétences
          et les communications de l'équipe enseignante.
        </p>
        <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;
                    padding:16px 20px;margin:0 0 24px">
          <div style="font-size:12px;color:#64748b;margin-bottom:4px">Élève concerné(e)</div>
          <div style="font-weight:800;color:#0f172a;font-size:15px">${studentName}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${schoolName}</div>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${invitationLink}"
             style="display:inline-block;padding:13px 32px;border-radius:12px;
                    background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);
                    color:#fff;font-weight:800;font-size:14px;text-decoration:none">
            Accéder au portail parents →
          </a>
        </div>
        <p style="font-size:11px;color:#94a3b8;margin:0">
          Ce lien est valable 7 jours. Si vous n'attendiez pas cet email, ignorez-le.
        </p>
      </div>
    `);

    await resend.emails.send({
      from: FROM,
      to,
      subject: `Invitation au portail parents — ${studentName} — ${schoolName}`,
      html,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ─── Email de confirmation d'abonnement ──────────────────────────────────

export async function sendSubscriptionConfirmationEmail(params: {
  to: string;
  firstName: string;
  plan: "pro" | "ecole";
  billing: "monthly" | "annual";
}): Promise<SendResult> {
  try {
    const resend = getResend();
    const { to, firstName, plan, billing } = params;

    const planLabel = plan === "pro" ? "Pro Professeur" : "École";
    const billingLabel = billing === "monthly" ? "mensuel" : "annuel";

    const html = baseLayout(`
      <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:28px 32px">
        <div style="font-size:20px;font-weight:900;color:#fff">Abonnement activé ✅</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">
          Plan ${planLabel} · ${billingLabel}
        </div>
      </div>
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#0f172a;margin:0 0 16px">Bonjour ${firstName},</p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px">
          Ton abonnement <strong>Klasbook ${planLabel}</strong> est actif.
          Tu as désormais accès à toutes les fonctionnalités sans limitation.
        </p>
        <div style="background:#f0fdf4;border-radius:10px;border:1px solid #86efac;
                    padding:16px 20px;margin:0 0 24px">
          <div style="font-weight:800;color:#16a34a;font-size:14px;margin-bottom:8px">
            ✓ Ce qui est inclus dans ton plan
          </div>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:1.8">
            <li>Génération d'exercices IA illimitée</li>
            <li>7 matières — référentiels IFPC/FWB intégrés</li>
            <li>Page élève + correction IA des copies</li>
            <li>Bulletins et compétences FWB</li>
            <li>Portail parents intégré</li>
            ${plan === "ecole" ? "<li>Portail direction + jusqu'à 20 professeurs</li>" : ""}
          </ul>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="https://klasbook.be/dashboard"
             style="display:inline-block;padding:13px 32px;border-radius:12px;
                    background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);
                    color:#fff;font-weight:800;font-size:14px;text-decoration:none">
            Aller sur mon tableau de bord →
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="font-size:12px;color:#94a3b8;margin:0">
          Gérer mon abonnement :
          <a href="https://klasbook.be/profil" style="color:#0A84FF">Mon profil Klasbook</a>
        </p>
      </div>
    `);

    await resend.emails.send({
      from: FROM,
      to,
      subject: `Bienvenue sur Klasbook ${planLabel} 🚀`,
      html,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

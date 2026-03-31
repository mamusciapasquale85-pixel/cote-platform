# KLASBOOK — Journal de bord technique

## Stack
- **Frontend** : Next.js 15 + TypeScript + React 19
- **Auth / DB** : Supabase (projet `wvgluiycajijcpfifrjv`, région EU)
- **IA** : Anthropic Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- **Paiements** : Stripe (live, compte Pasquale)
- **Emails** : Resend (`noreply@klasbook.be`, DNS configurés sur Vercel)
- **Analytics** : PostHog EU (`eu.i.posthog.com`)
- **Hosting** : Vercel, team `mamusciapasquale85-6856s-projects`, projet `klasbook`
- **Domaine** : `klasbook.be` (DNS géré par Vercel / NS1)
- **Repo GitHub** : `mamusciapasquale85-pixel/cote-platform`

---

## Variables d'environnement (.env.local + Vercel)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        ← clé sb_secret_... (pour webhook Stripe)
ANTHROPIC_API_KEY
RESEND_API_KEY
NEXT_PUBLIC_APP_URL=https://klasbook.be
STRIPE_SECRET_KEY                ← sk_live_...
STRIPE_WEBHOOK_SECRET            ← whsec_...
STRIPE_PRICE_PRO_MONTHLY         ← price_1TGfh7...
STRIPE_PRICE_PRO_ANNUAL          ← price_1TGfh8...
STRIPE_PRICE_ECOLE_MONTHLY       ← price_1TGfh8...
STRIPE_PRICE_ECOLE_ANNUAL        ← price_1TGfh9...
NEXT_PUBLIC_POSTHOG_KEY          ← phc_dMH...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

---

## Fonctionnalités construites

### Freemium & Billing
- `src/lib/billing.ts` — logique quota (10 exo/mois gratuit), `getUserPlan`, `checkAndIncrementExerciceUsage`
- `src/app/api/billing/checkout/route.ts` — création session Stripe Checkout (30j trial)
- `src/app/api/billing/webhook/route.ts` — webhook Stripe (met à jour `user_profiles.plan`)
- `src/app/api/billing/portal/route.ts` — portail Stripe (annulation, factures)
- `src/app/api/billing/usage/route.ts` — GET usage du mois en cours
- `src/app/pricing/page.tsx` — page pricing (Gratuit / Pro 9€ / École 49€)

### Plans & Accès
- Plan `free` : 10 exercices/mois
- Plan `pro` : illimité (9€/mois ou 79€/an)
- Plan `ecole` : illimité (49€/mois ou 490€/an)
- Plan `collegue` : illimité, gratuit à vie (pas de date expiration)
- **Auto-collegue** : trigger Supabase sur `auth.users` — tout email `@spfb.edu.brussels` ou `@spfb.brussels` → plan `collegue` automatique
- **Code promo** : table `promo_codes`, code actif = `KLASBETA2026` → plan collegue
  - Champ optionnel à l'étape "École" du wizard d'inscription
  - Validation dans `src/app/api/register/route.ts`

### Emails (Resend)
- `src/lib/emails/index.ts` — `sendWelcomeEmail`, `sendParentInvitationEmail`, `sendSubscriptionConfirmationEmail`
- FROM : `Klasbook <noreply@klasbook.be>`
- DNS Resend ajoutés dans Vercel : DKIM (`resend._domainkey`), MX + SPF (`send`)

### Pages légales
- `src/app/vie-privee/page.tsx` — politique RGPD (droit belge)
- `src/app/cgu/page.tsx` — CGU/CGV (droit belge, juridiction Bruxelles)

### Générateur IA (amélioré)
- `src/app/api/generer-exercice/route.ts`
- `src/lib/referentiels-fwb.ts` — référentiels officiels FWB (Tronc Commun)
- **Mémoire pédagogique** : lit les 5 derniers exercices (même matière/niveau/prof) → injectés dans le prompt pour éviter répétition
- **Contexte élève** : si `student_id` passé → récupère évaluations récentes → remédiation ciblée
- **Contexte hebdo** : table `ia_contexte_hebdo` → top thèmes + types négligés injectés dans chaque prompt
- **Cron** : `pg_cron` chaque lundi 3h → `refresh_ia_contexte_hebdo()` analyse les 30 derniers jours

### Analytics
- PostHog snippet dans `src/app/layout.tsx` (conditionnel sur `NEXT_PUBLIC_POSTHOG_KEY`)
- Région EU, host `eu.i.posthog.com`

---

## Tables Supabase ajoutées

| Table | Description |
|-------|-------------|
| `exercices` | Exercices générés (teacher_id, subject, type, niveau, theme, contenu) |
| `usage_mensuel` | Compteur mensuel par user (user_id, mois, nb_exercices) |
| `promo_codes` | Codes promo (code, plan, active) |
| `ia_contexte_hebdo` | Contexte IA mis à jour chaque semaine (semaine, subject, top_themes, types_negliges) |

### Colonnes ajoutées à `user_profiles`
- `plan` TEXT (free / pro / ecole / collegue)
- `plan_expires_at` TIMESTAMPTZ (NULL = à vie)
- `stripe_customer_id` TEXT

---

## Stripe
- Produit **Pro Prof** : `prod_UFA0CTaSFDETkv`
- Produit **École** : `prod_UFA0QJkrsHJ9IR`
- Webhook : `we_1TGfhGBDw1nW83itEManFn4n` → `https://klasbook.be/api/billing/webhook`
- Events : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

---

## Commandes utiles

### Donner accès collegue à quelqu'un
```sql
UPDATE user_profiles SET plan = 'collegue', plan_expires_at = NULL
WHERE id = (SELECT id FROM auth.users WHERE email = 'email@exemple.be');
```

### Créer un nouveau code promo
```sql
INSERT INTO promo_codes (code, plan, active) VALUES ('MONCODE2026', 'collegue', true);
```

### Désactiver un code promo
```sql
UPDATE promo_codes SET active = false WHERE code = 'KLASBETA2026';
```

### Activer facturation pour les @spfb (quand Pasquale le décide)
```sql
DROP TRIGGER IF EXISTS trg_collegue_plan_on_signup ON auth.users;
-- Les nouveaux inscrits SPFB seront en plan free comme les autres.
-- Les anciens gardent leur plan collegue (ne change pas automatiquement).
```

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// ─── Webhook Stripe ─────────────────────────────────────────────────────────
// Variable d'environnement requise : STRIPE_WEBHOOK_SECRET=whsec_...
// À récupérer dans Stripe Dashboard → Developers → Webhooks → votre endpoint
//
// URL du webhook à configurer dans Stripe : https://klasbook.be/api/billing/webhook
// Événements à écouter :
//   - checkout.session.completed
//   - customer.subscription.updated
//   - customer.subscription.deleted

export const runtime = "nodejs";

// Client Supabase avec service role (pas de cookie — contexte serveur pur)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

function planFromMetadata(subscription: Stripe.Subscription): string {
  return (subscription.metadata?.plan as string) ?? "pro";
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET manquant" }, { status: 500 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const stripe = new Stripe(stripeKey, { apiVersion: "2026-03-25.dahlia" });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Signature invalide";
    console.error("[Stripe Webhook] Erreur signature:", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {

      // ─── Paiement réussi / abonnement activé ──────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        ) as unknown as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        const plan = planFromMetadata(subscription);
        const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

        await supabase
          .from("user_profiles")
          .update({
            plan,
            plan_expires_at: expiresAt,
            stripe_customer_id: session.customer as string,
          })
          .eq("id", userId);

        console.log(`[Stripe] Abonnement activé : user=${userId} plan=${plan}`);
        break;
      }

      // ─── Renouvellement / modification ────────────────────────────────────
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        const isActive = ["active", "trialing"].includes(subscription.status);
        const plan = isActive ? planFromMetadata(subscription) : "free";
        const expiresAt = isActive
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        await supabase
          .from("user_profiles")
          .update({ plan, plan_expires_at: expiresAt })
          .eq("id", userId);

        console.log(`[Stripe] Abonnement mis à jour : user=${userId} status=${subscription.status} plan=${plan}`);
        break;
      }

      // ─── Résiliation ───────────────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        await supabase
          .from("user_profiles")
          .update({ plan: "free", plan_expires_at: null })
          .eq("id", userId);

        console.log(`[Stripe] Abonnement résilié : user=${userId}`);
        break;
      }

      default:
        // Événement non géré — on ignore silencieusement
        break;
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Stripe Webhook] Erreur traitement:", msg);
    // On renvoie 200 quand même pour que Stripe ne réessaie pas en boucle
  }

  return NextResponse.json({ received: true });
}

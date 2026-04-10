/**
 * remediations-handler.ts
 *
 * Logique métier pour les opérations DELETE et PATCH sur une remédiation.
 * Isolée ici pour éviter de toucher src/app/api/remediations/[id]/route.ts
 * qui contient un contournement du bug Next.js 15 async params.
 *
 * NE PAS modifier route.ts — modifier ce fichier à la place.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export const STATUTS_VALIDES = ["Proposee", "En cours", "Terminee"] as const;
export type StatutRemediation = (typeof STATUTS_VALIDES)[number];

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function deleteRemediation(
  supabase: SupabaseClient,
  id: string
): Promise<{ ok: true } | { error: string; status: number }> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { error: "Non authentifié", status: 401 };
  }

  const { error } = await supabase
    .from("remediations")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message, status: 500 };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// PATCH — mise à jour du statut
// ---------------------------------------------------------------------------

export async function patchRemediationStatut(
  supabase: SupabaseClient,
  id: string,
  body: unknown
): Promise<
  | { item: { id: string; statut: string } }
  | { error: string; status: number }
> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { error: "Non authentifié", status: 401 };
  }

  const statut = (body as { statut?: string })?.statut;

  if (!statut || !(STATUTS_VALIDES as readonly string[]).includes(statut)) {
    return { error: "Statut invalide.", status: 400 };
  }

  const { data, error } = await supabase
    .from("remediations")
    .update({ statut })
    .eq("id", id)
    .select("id, statut")
    .single();

  if (error) {
    return { error: error.message, status: 500 };
  }

  return { item: data as { id: string; statut: string } };
}

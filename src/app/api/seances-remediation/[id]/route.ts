import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SeanceStatut = "Planifiee" | "Realisee" | "Annulee";

const ALLOWED_STATUTS: SeanceStatut[] = ["Planifiee", "Realisee", "Annulee"];

function toErrorMessage(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message) return error.message;
    if ("error_description" in error && typeof error.error_description === "string" && error.error_description) {
      return error.error_description;
    }
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toDbStatut(value: unknown): SeanceStatut {
  const normalized = normalizeText(typeof value === "string" ? value : "").replace(/\s+/g, " ");
  if (normalized === "planifiee" || normalized === "planifie") return "Planifiee";
  if (normalized === "realisee" || normalized === "realise") return "Realisee";
  if (normalized === "annulee" || normalized === "annule") return "Annulee";
  return "Planifiee";
}

function toInt(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function uniqIds(values: unknown[]): string[] {
  const normalized = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
}

function isIsoDateTime(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

async function ensureAuth(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userData.user) throw new Error("Non authentifié");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    await ensureAuth(supabase);

    const { id } = await params;
    const seanceId = id?.trim();
    if (!seanceId) {
      return NextResponse.json({ error: "id manquant" }, { status: 400 });
    }

    const body = (await req.json()) as {
      statut?: string;
      notes?: string | null;
      date_seance?: string;
      duree_minutes?: number;
      eleve_ids?: string[];
    };

    const patch: Record<string, unknown> = {};

    if (body.statut != null) {
      const statut = toDbStatut(body.statut);
      if (!ALLOWED_STATUTS.includes(statut)) {
        return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
      }
      patch.statut = statut;
    }

    if (body.notes !== undefined) {
      patch.notes = body.notes == null ? null : String(body.notes).trim();
    }

    if (body.date_seance !== undefined) {
      const dateSeance = String(body.date_seance).trim();
      if (!isIsoDateTime(dateSeance)) {
        return NextResponse.json({ error: "date_seance invalide (ISO attendu)" }, { status: 400 });
      }
      patch.date_seance = new Date(dateSeance).toISOString();
    }

    if (body.duree_minutes !== undefined) {
      const duration = toInt(body.duree_minutes);
      if (duration == null || duration <= 0) {
        return NextResponse.json({ error: "duree_minutes invalide" }, { status: 400 });
      }
      patch.duree_minutes = duration;
    }

    if (Object.keys(patch).length > 0) {
      const updateRes = await supabase
        .from("seances_remediation")
        .update(patch)
        .eq("id", seanceId)
        .select("id,date_seance,duree_minutes,statut,notes,created_at,remediation_id")
        .maybeSingle();

      if (updateRes.error) throw updateRes.error;
      if (!updateRes.data) {
        return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
      }
    }

    if (body.eleve_ids) {
      const ids = uniqIds(body.eleve_ids);
      if (ids.length === 0) {
        return NextResponse.json({ error: "Sélectionne au moins un élève." }, { status: 400 });
      }

      const deleteRes = await supabase.from("seance_eleves").delete().eq("seance_id", seanceId);
      if (deleteRes.error) throw deleteRes.error;

      const insertRes = await supabase
        .from("seance_eleves")
        .upsert(ids.map((eleveId) => ({ seance_id: seanceId, eleve_id: eleveId })), {
          onConflict: "seance_id,eleve_id",
        });
      if (insertRes.error) throw insertRes.error;
    }

    const finalRes = await supabase
      .from("seances_remediation")
      .select("id,date_seance,duree_minutes,statut,notes,created_at,remediation_id")
      .eq("id", seanceId)
      .maybeSingle();

    if (finalRes.error) throw finalRes.error;
    if (!finalRes.data) {
      return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
    }

    return NextResponse.json({ item: finalRes.data });
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    await ensureAuth(supabase);

    const { id } = await params;
    const seanceId = id?.trim();
    if (!seanceId) {
      return NextResponse.json({ error: "id manquant" }, { status: 400 });
    }

    const delRes = await supabase.from("seances_remediation").delete().eq("id", seanceId);
    if (delRes.error) throw delRes.error;

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ApiStatut = "Proposee" | "En cours" | "Terminee";

const ALLOWED_STATUSES: ApiStatut[] = ["Proposee", "En cours", "Terminee"];

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

function toApiStatut(value: string | null | undefined): ApiStatut | null {
  if (!value) return null;
  const normalized = normalizeText(value).replace(/\s+/g, " ");
  if (normalized === "proposee" || normalized === "propose") return "Proposee";
  if (normalized === "en cours" || normalized === "encours") return "En cours";
  if (normalized === "terminee" || normalized === "termine") return "Terminee";
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const remediationId = id?.trim();

    if (!remediationId) {
      return NextResponse.json({ error: "Identifiant de remédiation manquant" }, { status: 400 });
    }

    const body = (await req.json()) as { statut?: string };
    const statut = toApiStatut(body.statut);

    if (!statut || !ALLOWED_STATUSES.includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("remediations")
      .update({ statut })
      .eq("id", remediationId)
      .select("id,statut")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Remédiation introuvable" }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

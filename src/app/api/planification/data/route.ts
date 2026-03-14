// src/app/api/planification/data/route.ts
// Route UNIVERSELLE — dispatch selon source_type et retourne toujours le même format

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ── Type unifié (indépendant de la source) ───────────────────────────────────
export type PlanSemaine = {
  id: string;
  is_header: boolean;
  date_label: string;
  support: string | null;
  titres: string;
  objectifs: string;
  competences: string;
  numerique: string;
  fichiers: { name: string; url?: string; notion_page_id?: string; type: "evaluation" | "lecon" | "autre" }[];
  notion_page_id?: string;
  notion_url?: string;
  source_type: string;
};

// ── Handler Notion ───────────────────────────────────────────────────────────
async function fetchNotion(dbId: string, token: string): Promise<PlanSemaine[]> {
  const results: PlanSemaine[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(`Notion ${res.status}: ${(e as Record<string, string>).message ?? res.statusText}`);
    }

    const data = await res.json();

    for (const page of data.results) {
      const p = page.properties;
      const txt = (prop: Record<string, unknown>): string => {
        if (!prop) return "";
        if (prop.type === "title") return (prop.title as Array<{ plain_text: string }>).map(t => t.plain_text).join("");
        if (prop.type === "rich_text") return (prop.rich_text as Array<{ plain_text: string }>).map(t => t.plain_text).join("");
        if (prop.type === "select") return (prop.select as { name: string } | null)?.name ?? "";
        return "";
      };
      const hasFiles = (prop: Record<string, unknown>) =>
        prop?.type === "files" && ((prop.files as unknown[]) ?? []).length > 0;

      const dateLabel = txt(p["Date"]);
      const fichiers: PlanSemaine["fichiers"] = [];
      if (hasFiles(p["Évaluations"])) fichiers.push({ name: "Évaluation formative", notion_page_id: page.id, type: "evaluation" });
      if (hasFiles(p["PDF Leçons"])) fichiers.push({ name: "PDF Leçon", notion_page_id: page.id, type: "lecon" });

      results.push({
        id: page.id,
        is_header: dateLabel.startsWith("⬛"),
        date_label: dateLabel,
        support: txt(p["Support"]) || null,
        titres: txt(p["Titres des leçons"]),
        objectifs: txt(p["Objectifs pédagogiques"]),
        competences: txt(p["Compétences / Taches finale"]),
        numerique: txt(p["Numérique"]),
        fichiers,
        notion_page_id: page.id,
        notion_url: page.url,
        source_type: "notion",
      });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return results;
}

// ── Handler Supabase manuel ──────────────────────────────────────────────────
async function fetchManuel(sourceId: string, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<PlanSemaine[]> {
  const { data, error } = await supabase
    .from("planification_semaines")
    .select("*")
    .eq("source_id", sourceId)
    .order("position");

  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    id: row.id,
    is_header: row.is_header,
    date_label: row.date_label ?? "",
    support: row.support,
    titres: row.titres ?? "",
    objectifs: row.objectifs ?? "",
    competences: row.competences ?? "",
    numerique: row.numerique ?? "",
    fichiers: (row.fichiers ?? []) as PlanSemaine["fichiers"],
    source_type: "manuel",
  }));
}

// ── Route principale ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const sourceId = req.nextUrl.searchParams.get("sourceId");
  if (!sourceId) return NextResponse.json({ error: "sourceId manquant" }, { status: 400 });

  // Récupérer la source et vérifier les droits
  const { data: source, error: srcError } = await supabase
    .from("planification_sources")
    .select("*")
    .eq("id", sourceId)
    .eq("teacher_id", user.id)
    .single();

  if (srcError || !source) return NextResponse.json({ error: "Source introuvable" }, { status: 404 });

  try {
    let semaines: PlanSemaine[] = [];

    switch (source.source_type) {
      case "notion": {
        const token = process.env.NOTION_TOKEN;
        if (!token) throw new Error("NOTION_TOKEN manquant dans .env.local");
        const dbId = (source.config as Record<string, string>).db_id;
        if (!dbId) throw new Error("db_id manquant dans la config de cette source");
        semaines = await fetchNotion(dbId, token);
        break;
      }

      case "manuel":
      case "fichier": {
        semaines = await fetchManuel(sourceId, supabase);
        break;
      }

      case "google_sheets": {
        // Placeholder — à implémenter si besoin
        throw new Error("Google Sheets pas encore implémenté. Utilise l'import manuel pour l'instant.");
      }

      default:
        throw new Error(`Type de source inconnu : ${source.source_type}`);
    }

    return NextResponse.json({ semaines, source });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}

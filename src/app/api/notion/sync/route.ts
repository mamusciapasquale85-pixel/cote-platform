import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const NOTION_DB_ID = "2ec1749daf3f809f9ed2c4ff7d8b8b0c";

function toErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as any).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}

// Extrait le texte brut d'une propriété Notion (title, rich_text, select, date, etc.)
function extractText(prop: any): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title":
      return (prop.title ?? []).map((t: any) => t.plain_text ?? "").join("");
    case "rich_text":
      return (prop.rich_text ?? []).map((t: any) => t.plain_text ?? "").join("");
    case "select":
      return prop.select?.name ?? "";
    case "multi_select":
      return (prop.multi_select ?? []).map((s: any) => s.name).join(", ");
    case "date":
      return prop.date?.start ?? "";
    case "checkbox":
      return prop.checkbox ? "true" : "false";
    case "number":
      return prop.number != null ? String(prop.number) : "";
    case "url":
      return prop.url ?? "";
    default:
      return "";
  }
}

async function queryNotion(token: string, cursor?: string) {
  const body: any = { page_size: 100 };
  if (cursor) body.start_cursor = cursor;

  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  const msg = (err as any).message ?? res.statusText;
    console.error("[Notion API error]", res.status, msg, "token prefix:", token.slice(0, 8));
    throw new Error(`Notion API ${res.status}: ${msg}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("x-notion-token") ??
      process.env.NOTION_TOKEN ?? "";
    if (!token) return NextResponse.json({ error: "Token Notion manquant" }, { status: 400 });

    // Récupère toutes les pages (pagination)
    const allResults: any[] = [];
    let cursor: string | undefined;
    do {
      const page = await queryNotion(token, cursor);
      allResults.push(...(page.results ?? []));
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);

    // Inspecte les propriétés de la première page pour mapping
    const firstPage = allResults[0];
    const propNames = firstPage ? Object.keys(firstPage.properties) : [];

    // Mappe chaque page en entrée structurée
    const entries = allResults.map((page: any) => {
      const props = page.properties ?? {};
      const entry: Record<string, string> = { notion_id: page.id, notion_url: page.url };
      for (const key of propNames) {
        entry[key] = extractText(props[key]);
      }
      return entry;
    });

    return NextResponse.json({
      total: allResults.length,
      prop_names: propNames,
      entries,
    });
  } catch (e) {
    return NextResponse.json({ error: toErr(e) }, { status: 500 });
  }
}

// POST : sync vers Supabase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token: string = body.notion_token ?? process.env.NOTION_TOKEN ?? "";
    const mapping: {
      titre?: string;
      date?: string;
      type?: string;
      competence?: string;
      periode?: string;
      description?: string;
    } = body.mapping ?? {};

    if (!token) return NextResponse.json({ error: "Token Notion manquant" }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { data: mem } = await supabase.from("school_memberships")
      .select("school_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
    if (!mem?.school_id) throw new Error("École introuvable");
    const schoolId = mem.school_id;

    const { data: ay } = await supabase.from("academic_years")
      .select("id").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ay?.id) throw new Error("Année scolaire introuvable");
    const academicYearId = ay.id;

    // Récupère toutes les pages Notion
    const allResults: any[] = [];
    let cursor: string | undefined;
    do {
      const page = await queryNotion(token, cursor);
      allResults.push(...(page.results ?? []));
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);

    let synced_evals = 0, synced_agenda = 0, skipped = 0;

    for (const page of allResults) {
      const props = page.properties ?? {};

      const titre = mapping.titre ? extractText(props[mapping.titre]) : "";
      const date = mapping.date ? extractText(props[mapping.date]) : null;
      const type = mapping.type ? extractText(props[mapping.type]) : null;
      const competence = mapping.competence ? extractText(props[mapping.competence]) : null;
      const periode = mapping.periode ? extractText(props[mapping.periode]) : null;
      const description = mapping.description ? extractText(props[mapping.description]) : null;

      if (!titre) { skipped++; continue; }

      const isEval = type?.toLowerCase().includes("eval") ||
        type?.toLowerCase().includes("éval") ||
        type?.toLowerCase().includes("sommative") ||
        type?.toLowerCase().includes("formative");

      if (isEval) {
        // Crée une évaluation dans assessments
        const { error } = await supabase.from("assessments").upsert({
          school_id: schoolId,
          academic_year_id: academicYearId,
          teacher_id: userData.user.id,
          title: titre,
          date: date || null,
          type: type || "formative",
          description: competence ? `Compétence : ${competence}${description ? "\n" + description : ""}` : description,
          notion_id: page.id,
        } as any, { onConflict: "notion_id" as any, ignoreDuplicates: false });

        if (!error) synced_evals++;
        else console.error("assessment upsert:", error);
      } else {
        // Crée un événement agenda
        const { error } = await supabase.from("agenda_items").upsert({
          school_id: schoolId,
          academic_year_id: academicYearId,
          teacher_id: userData.user.id,
          title: titre,
          date: date || null,
          type: type || "lecon",
          notes: competence ? `Compétence : ${competence}${description ? "\n" + description : ""}` : description,
          notion_id: page.id,
        } as any, { onConflict: "notion_id" as any, ignoreDuplicates: false });

        if (!error) synced_agenda++;
        else console.error("agenda upsert:", error);
      }
    }

    return NextResponse.json({
      ok: true,
      total: allResults.length,
      synced_evals,
      synced_agenda,
      skipped,
    });
  } catch (e) {
    return NextResponse.json({ error: toErr(e) }, { status: 500 });
  }
}

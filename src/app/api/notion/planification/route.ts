import { NextResponse } from "next/server";

const NOTION_DB_ID = "2ec1749daf3f809f9ed2c4ff7d8b8b0c";
const NOTION_VERSION = "2022-06-28";

export type NotionSemaine = {
  id: string; url: string; notion_url: string; date: string;
  support: string | null; titres: string; objectifs: string;
  competences: string; numerique: string;
  hasPdfLecons: boolean; hasEvaluation: boolean;
};

async function fetchAllPages(token: string): Promise<NotionSemaine[]> {
  const results: NotionSemaine[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
      results.push({
        id: page.id, url: page.url, notion_url: page.url,
        date: txt(p["Date"]), support: txt(p["Support"]) || null,
        titres: txt(p["Titres des leçons"]),
        objectifs: txt(p["Objectifs pédagogiques"]),
        competences: txt(p["Compétences / Taches finale"]),
        numerique: txt(p["Numérique"]),
        hasPdfLecons: hasFiles(p["PDF Leçons"]),
        hasEvaluation: hasFiles(p["Évaluations"]),
      });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "NOTION_TOKEN manquant dans .env.local" }, { status: 500 });
  }
  try {
    const semaines = await fetchAllPages(token);
    return NextResponse.json({ semaines });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}

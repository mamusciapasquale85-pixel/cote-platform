// src/app/api/notion/download/route.ts
// Retourne l'URL signée Notion pour téléchargement côté client

import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";

export async function GET(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN manquant" }, { status: 500 });

  const pageId = req.nextUrl.searchParams.get("pageId");
  const fileType = req.nextUrl.searchParams.get("type") ?? "evaluation";

  if (!pageId) return NextResponse.json({ error: "pageId manquant" }, { status: 400 });

  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    },
    // Ne pas mettre en cache — les URLs signées expirent
    cache: "no-store",
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: `Notion ${res.status}: ${(e as Record<string, string>).message ?? res.statusText}` },
      { status: res.status }
    );
  }

  const page = await res.json();
  const propName = fileType === "lecon" ? "PDF Leçons" : "Évaluations";
  const fileProp = page.properties[propName];

  if (!fileProp || fileProp.type !== "files" || fileProp.files.length === 0) {
    return NextResponse.json({ error: `Aucun fichier dans "${propName}"` }, { status: 404 });
  }

  // Extraire les URLs signées (valides ~1h)
  const files = fileProp.files
    .map((f: Record<string, unknown>) => {
      if (f.type === "file") {
        const fd = f.file as { url: string; expiry_time: string };
        return { name: (f.name as string) ?? "fichier.pdf", url: fd.url, expiry: fd.expiry_time };
      }
      if (f.type === "external") {
        return { name: (f.name as string) ?? "fichier.pdf", url: (f.external as { url: string }).url, expiry: null };
      }
      return null;
    })
    .filter(Boolean);

  if (files.length === 0) {
    return NextResponse.json({ error: "URLs non disponibles" }, { status: 404 });
  }

  // Toujours retourner JSON — le client ouvre l'URL directement
  return NextResponse.json({ files });
}

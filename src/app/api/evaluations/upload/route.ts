// src/app/api/evaluations/upload/route.ts
// Upload d'un fichier PDF/Word vers Supabase Storage + lien à l'évaluation

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const assessmentId = formData.get("assessmentId") as string | null;

  if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  if (!assessmentId) return NextResponse.json({ error: "assessmentId manquant" }, { status: 400 });

  // Chemin : userId/assessmentId/nom_du_fichier
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${assessmentId}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("evaluations")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  // Mettre à jour l'évaluation avec le chemin du fichier
  const { error: updateError } = await supabase
    .from("assessments")
    .update({ fichier_path: path, fichier_nom: file.name })
    .eq("id", assessmentId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, path, nom: file.name });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const assessmentId = req.nextUrl.searchParams.get("assessmentId");
  const path = req.nextUrl.searchParams.get("path");
  if (!assessmentId || !path) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  await supabase.storage.from("evaluations").remove([path]);

  const { error } = await supabase
    .from("assessments")
    .update({ fichier_path: null, fichier_nom: null })
    .eq("id", assessmentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path manquant" }, { status: 400 });

  const { data, error } = await supabase.storage
    .from("evaluations")
    .createSignedUrl(path, 300); // URL valide 5 min

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}

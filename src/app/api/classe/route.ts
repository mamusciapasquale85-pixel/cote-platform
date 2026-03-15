// src/app/api/classe/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const classGroupId = req.nextUrl.searchParams.get("classGroupId");
  if (!classGroupId) return NextResponse.json({ error: "classGroupId manquant" }, { status: 400 });

  const { data: enrollments, error: enrollErr } = await supabase
    .from("student_enrollments")
    .select("student_id, students (id, first_name, last_name)")
    .eq("class_group_id", classGroupId);

  if (enrollErr) return NextResponse.json({ error: enrollErr.message }, { status: 500 });

  const studentIds = ((enrollments ?? []) as any[]).map((e: any) => e.student_id as string);
  if (studentIds.length === 0) return NextResponse.json({ eleves: [] });

  const { data: resultats, error: resErr } = await supabase
    .from("resultats")
    .select("student_id, level, value, created_at")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });

  if (resErr) return NextResponse.json({ error: resErr.message }, { status: 500 });

  const eleves = ((enrollments ?? []) as any[]).map((enrollment: any) => {
    const student = enrollment.students;
    if (!student) return null;

    const res = ((resultats ?? []) as any[]).filter((r: any) => r.student_id === student.id);
    const total = res.length;
    const niveaux = { TM: 0, M: 0, NM: 0, NI: 0 };
    for (const r of res) {
      if (r.level && r.level in niveaux) niveaux[r.level as keyof typeof niveaux]++;
    }
    const scoreMaitrise = total > 0
      ? Math.round(((niveaux.TM * 4 + niveaux.M * 3 + niveaux.NM * 2 + niveaux.NI * 1) / (total * 4)) * 100)
      : null;

    return {
      id: student.id,
      prenom: student.first_name,
      nom: student.last_name,
      total_resultats: total,
      niveaux,
      score_maitrise: scoreMaitrise,
      dernier_niveau: res[0]?.level ?? null,
      en_difficulte: niveaux.NI > 0,
    };
  }).filter(Boolean);

  eleves.sort((a: any, b: any) => {
    if (a.niveaux.NI > 0 && b.niveaux.NI === 0) return -1;
    if (b.niveaux.NI > 0 && a.niveaux.NI === 0) return 1;
    return (a.score_maitrise ?? 100) - (b.score_maitrise ?? 100);
  });

  return NextResponse.json({ eleves });
}

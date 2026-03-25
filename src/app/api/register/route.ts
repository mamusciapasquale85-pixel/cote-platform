import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const MATIERES_MAP: Record<string, string> = {
  nl: "Néerlandais", francais: "Français", mathematiques: "Mathématiques",
  sciences: "Sciences", histoire: "Histoire", geographie: "Géographie",
  anglais: "Anglais", allemand: "Allemand", espagnol: "Espagnol",
  latin: "Latin", ed_physique: "Éd. physique", arts: "Arts / Musique",
  religion: "Religion / Morale", informatique: "Informatique", autre: "Autre",
};

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, password, role, schoolName, subjects, className, gradeLevel } = await req.json();

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Créer l'utilisateur (email auto-confirmé → login immédiat)
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: `${firstName.trim()} ${lastName.trim()}` },
    });
    if (userError) return NextResponse.json({ error: userError.message }, { status: 400 });
    const userId = userData.user.id;

    // 2. Profil utilisateur
    await admin.from("user_profiles").insert({
      id: userId,
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      display_role: role,
      locale: "fr",
    });

    // 3. École — chercher ou créer
    let schoolId: string;
    const { data: existing } = await admin.from("schools").select("id").ilike("name", schoolName.trim()).limit(1).maybeSingle();
    if (existing) {
      schoolId = existing.id;
    } else {
      const { data: newSchool, error: se } = await admin.from("schools").insert({ name: schoolName.trim() }).select("id").single();
      if (se) throw new Error("Erreur création école: " + se.message);
      schoolId = newSchool!.id;
    }

    // 4. Année académique
    let yearId: string | undefined;
    const { data: existingYear } = await admin.from("academic_years").select("id").eq("school_id", schoolId).limit(1).maybeSingle();
    if (existingYear) {
      yearId = existingYear.id;
    } else {
      const { data: newYear } = await admin.from("academic_years")
        .insert({ school_id: schoolId, name: "2025-2026", start_date: "2025-09-01", end_date: "2026-06-30" })
        .select("id").single();
      yearId = newYear?.id;
    }

    // 5. Membership
    const primarySubject = subjects?.[0] ? MATIERES_MAP[subjects[0]] || subjects[0] : null;
    await admin.from("school_memberships").insert({
      school_id: schoolId,
      user_id: userId,
      role,
      ...(primarySubject ? { matiere: primarySubject } : {}),
    });

    // 6. Cours (enseignant)
    if (role === "teacher" && subjects?.length > 0) {
      await admin.from("courses").insert(
        subjects.map((id: string) => ({
          school_id: schoolId,
          name: MATIERES_MAP[id] || id,
          subject_area: id,
          grade_band: "secondaire",
        }))
      );
    }

    // 7. Classe principale (enseignant, optionnel)
    if (role === "teacher" && className?.trim() && yearId) {
      await admin.from("class_groups").insert({
        school_id: schoolId,
        academic_year_id: yearId,
        name: className.trim(),
        grade_level: gradeLevel ?? 7,
        teacher_id: userId,
      });
    }

    const redirectTo = role === "admin" ? "/direction" : role === "parent" ? "/parent" : "/dashboard";
    return NextResponse.json({ success: true, redirectTo });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inattendue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

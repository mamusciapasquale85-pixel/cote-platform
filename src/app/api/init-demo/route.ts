import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("token") !== "klasbook-init-2025") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
  const DEMO_SCHOOL_ID = "00000000-0000-0000-0000-000000000010";
  const DEMO_YEAR_ID = "00000000-0000-0000-0000-000000000020";

  const errors: string[] = [];

  // ── 1. Mot de passe démo ─────────────────────────────────────────────────
  const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(DEMO_USER_ID, {
    password: "KlasbookDemo2025!",
    email_confirm: true,
  });
  if (pwErr) errors.push(`password: ${pwErr.message}`);

  // ── 2. direction@klasbook.be mot de passe ─────────────────────────────────
  const { data: dirUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
  const dirUser = dirUsers?.users.find(u => u.email === "direction@klasbook.be");
  if (dirUser) {
    await supabaseAdmin.auth.admin.updateUserById(dirUser.id, {
      password: "KlasbookDemo2025!",
      email_confirm: true,
    });
  }

  // ── 3. Année scolaire ────────────────────────────────────────────────────
  await supabaseAdmin.from("academic_years").upsert({
    id: DEMO_YEAR_ID,
    school_id: DEMO_SCHOOL_ID,
    name: "2025-2026",
    start_date: "2025-09-01",
    end_date: "2026-06-30",
  }, { onConflict: "id", ignoreDuplicates: true });

  // ── 4. Cours ─────────────────────────────────────────────────────────────
  const COURSES = [
    { id: "00000000-0000-0000-0000-c00000000001", name: "Néerlandais",    subject_area: "languages",   grade_band: "secondaire" },
    { id: "00000000-0000-0000-0000-c00000000002", name: "Français",       subject_area: "languages",   grade_band: "secondaire" },
    { id: "00000000-0000-0000-0000-c00000000003", name: "Mathématiques",  subject_area: "mathematics", grade_band: "secondaire" },
    { id: "00000000-0000-0000-0000-c00000000004", name: "Sciences",       subject_area: "sciences",    grade_band: "secondaire" },
    { id: "00000000-0000-0000-0000-c00000000005", name: "Histoire",       subject_area: "humanities",  grade_band: "secondaire" },
    { id: "00000000-0000-0000-0000-c00000000006", name: "Géographie",     subject_area: "humanities",  grade_band: "secondaire" },
    { id: "00000000-0000-0000-0000-c00000000007", name: "Anglais",        subject_area: "languages",   grade_band: "secondaire" },
  ];
  const { error: cErr } = await supabaseAdmin.from("courses").upsert(
    COURSES.map(c => ({ ...c, school_id: DEMO_SCHOOL_ID })),
    { onConflict: "id", ignoreDuplicates: false }
  );
  if (cErr) errors.push(`courses: ${cErr.message}`);

  // ── 5. Classes ───────────────────────────────────────────────────────────
  const CLASS_GROUPS = [
    { id: "00000000-0000-0000-0000-a00000000001", name: "1A", grade_level: 7 },
    { id: "00000000-0000-0000-0000-a00000000002", name: "1B", grade_level: 7 },
    { id: "00000000-0000-0000-0000-a00000000003", name: "2A", grade_level: 8 },
    { id: "00000000-0000-0000-0000-a00000000004", name: "2B", grade_level: 8 },
    { id: "00000000-0000-0000-0000-a00000000005", name: "3A Néerlandais", grade_level: 9 },
    { id: "00000000-0000-0000-0000-a00000000006", name: "3B", grade_level: 9 },
  ];
  const { error: cgErr } = await supabaseAdmin.from("class_groups").upsert(
    CLASS_GROUPS.map(c => ({ ...c, school_id: DEMO_SCHOOL_ID, academic_year_id: DEMO_YEAR_ID, teacher_id: DEMO_USER_ID })),
    { onConflict: "id", ignoreDuplicates: false }
  );
  if (cgErr) errors.push(`class_groups: ${cgErr.message}`);

  // ── 6. Élèves démo ────────────────────────────────────────────────────────
  const FIRST_NAMES = ["Emma","Lucas","Léa","Nathan","Chloé","Hugo","Manon","Thomas","Sarah","Mathis","Camille","Louis","Inès","Théo","Julie","Evan","Marie","Antoine","Zoé","Paul","Alice","Romain","Lucie","Julien","Elisa","Maxime","Clara","Alexis","Laura","Quentin"];
  const LAST_NAMES  = ["Martin","Bernard","Dubois","Thomas","Robert","Richard","Petit","Durand","Leroy","Moreau","Simon","Laurent","Michel","Lefebvre","Garcia","David","Bertrand","Roux","Vincent","Fournier","Morel","Girard","André","Lambert","Mercier","Dupont","Bonnet","François","Mathieu","Picard"];

  const STUDENTS = Array.from({ length: 30 }, (_, i) => ({
    id: `00000000-0000-0000-0000-b${String(i + 1).padStart(11, "0")}`,
    first_name: FIRST_NAMES[i % FIRST_NAMES.length],
    last_name: LAST_NAMES[(i + 7) % LAST_NAMES.length],
    school_id: DEMO_SCHOOL_ID,
    teacher_id: DEMO_USER_ID,
  }));

  const { error: stErr } = await supabaseAdmin.from("students").upsert(
    STUDENTS, { onConflict: "id", ignoreDuplicates: false }
  );
  if (stErr) errors.push(`students: ${stErr.message}`);

  // ── 7. Inscriptions (5 élèves par classe) ────────────────────────────────
  const enrollments: { id: string; student_id: string; class_group_id: string; school_id: string }[] = [];
  CLASS_GROUPS.forEach((cls, ci) => {
    for (let si = 0; si < 5; si++) {
      const student = STUDENTS[ci * 5 + si];
      if (!student) return;
      enrollments.push({
        id: `00000000-0000-0000-0000-f${String(ci * 5 + si + 1).padStart(11, "0")}`,
        student_id: student.id,
        class_group_id: cls.id,
        school_id: DEMO_SCHOOL_ID,
      });
    }
  });
  const { error: enErr } = await supabaseAdmin.from("student_enrollments").upsert(
    enrollments, { onConflict: "id", ignoreDuplicates: false }
  );
  if (enErr) errors.push(`enrollments: ${enErr.message}`);

  // ── 8. Évaluations (30) ─────────────────────────────────────────────────
  const EVALS = [
    // Néerlandais — 1A
    { id: "00000000-0000-0000-0000-e00000000001", title: "Compréhension à la lecture — Les loisirs", course_id: "00000000-0000-0000-0000-c00000000001", class_group_id: "00000000-0000-0000-0000-a00000000001", type: "formative",  date: "2025-10-08", max_points: 20, weight: 1, matiere: "Néerlandais" },
    { id: "00000000-0000-0000-0000-e00000000002", title: "Expression écrite — Ma famille",           course_id: "00000000-0000-0000-0000-c00000000001", class_group_id: "00000000-0000-0000-0000-a00000000001", type: "summative",  date: "2025-11-14", max_points: 30, weight: 2, matiere: "Néerlandais" },
    { id: "00000000-0000-0000-0000-e00000000003", title: "Vocabulaire — La ville et les commerces",  course_id: "00000000-0000-0000-0000-c00000000001", class_group_id: "00000000-0000-0000-0000-a00000000001", type: "formative",  date: "2025-12-03", max_points: 15, weight: 1, matiere: "Néerlandais" },
    { id: "00000000-0000-0000-0000-e00000000004", title: "Examen 1er trimestre — Néerlandais",       course_id: "00000000-0000-0000-0000-c00000000001", class_group_id: "00000000-0000-0000-0000-a00000000001", type: "summative",  date: "2025-12-18", max_points: 50, weight: 3, matiere: "Néerlandais" },
    // Néerlandais — 1B
    { id: "00000000-0000-0000-0000-e00000000005", title: "Compréhension à l'audition — A la maison", course_id: "00000000-0000-0000-0000-c00000000001", class_group_id: "00000000-0000-0000-0000-a00000000002", type: "formative",  date: "2025-10-15", max_points: 20, weight: 1, matiere: "Néerlandais" },
    { id: "00000000-0000-0000-0000-e00000000006", title: "Expression orale — Se présenter",          course_id: "00000000-0000-0000-0000-c00000000001", class_group_id: "00000000-0000-0000-0000-a00000000002", type: "summative",  date: "2025-11-20", max_points: 25, weight: 2, matiere: "Néerlandais" },
    // Français — 2A
    { id: "00000000-0000-0000-0000-e00000000007", title: "Lecture — Le Petit Prince",               course_id: "00000000-0000-0000-0000-c00000000002", class_group_id: "00000000-0000-0000-0000-a00000000003", type: "summative",  date: "2025-10-10", max_points: 30, weight: 2, matiere: "Français" },
    { id: "00000000-0000-0000-0000-e00000000008", title: "Orthographe — Dictée n°3",                course_id: "00000000-0000-0000-0000-c00000000002", class_group_id: "00000000-0000-0000-0000-a00000000003", type: "formative",  date: "2025-11-05", max_points: 20, weight: 1, matiere: "Français" },
    { id: "00000000-0000-0000-0000-e00000000009", title: "Rédaction — Mon voyage imaginaire",        course_id: "00000000-0000-0000-0000-c00000000002", class_group_id: "00000000-0000-0000-0000-a00000000003", type: "summative",  date: "2025-12-05", max_points: 40, weight: 3, matiere: "Français" },
    // Maths — 1A
    { id: "00000000-0000-0000-0000-e00000000010", title: "Fractions et proportions",                course_id: "00000000-0000-0000-0000-c00000000003", class_group_id: "00000000-0000-0000-0000-a00000000001", type: "formative",  date: "2025-10-22", max_points: 25, weight: 1, matiere: "Mathématiques" },
    { id: "00000000-0000-0000-0000-e00000000011", title: "Géométrie — Triangles et angles",         course_id: "00000000-0000-0000-0000-c00000000003", class_group_id: "00000000-0000-0000-0000-a00000000001", type: "summative",  date: "2025-11-18", max_points: 30, weight: 2, matiere: "Mathématiques" },
    { id: "00000000-0000-0000-0000-e00000000012", title: "Algèbre — Équations du 1er degré",        course_id: "00000000-0000-0000-0000-c00000000003", class_group_id: "00000000-0000-0000-0000-a00000000001", type: "summative",  date: "2025-12-10", max_points: 40, weight: 3, matiere: "Mathématiques" },
    // Maths — 2A
    { id: "00000000-0000-0000-0000-e00000000013", title: "Statistiques descriptives",               course_id: "00000000-0000-0000-0000-c00000000003", class_group_id: "00000000-0000-0000-0000-a00000000003", type: "formative",  date: "2025-10-17", max_points: 20, weight: 1, matiere: "Mathématiques" },
    { id: "00000000-0000-0000-0000-e00000000014", title: "Systèmes d'équations",                    course_id: "00000000-0000-0000-0000-c00000000003", class_group_id: "00000000-0000-0000-0000-a00000000003", type: "summative",  date: "2025-11-25", max_points: 35, weight: 2, matiere: "Mathématiques" },
    // Sciences — 2B
    { id: "00000000-0000-0000-0000-e00000000015", title: "La cellule et ses organites",             course_id: "00000000-0000-0000-0000-c00000000004", class_group_id: "00000000-0000-0000-0000-a00000000004", type: "summative",  date: "2025-10-24", max_points: 30, weight: 2, matiere: "Sciences" },
    { id: "00000000-0000-0000-0000-e00000000016", title: "Réactions chimiques — Introduction",      course_id: "00000000-0000-0000-0000-c00000000004", class_group_id: "00000000-0000-0000-0000-a00000000004", type: "formative",  date: "2025-11-12", max_points: 20, weight: 1, matiere: "Sciences" },
    { id: "00000000-0000-0000-0000-e00000000017", title: "Physique — Les forces",                   course_id: "00000000-0000-0000-0000-c00000000004", class_group_id: "00000000-0000-0000-0000-a00000000004", type: "summative",  date: "2025-12-08", max_points: 40, weight: 3, matiere: "Sciences" },
    // Histoire — 3A
    { id: "00000000-0000-0000-0000-e00000000018", title: "La Révolution française",                 course_id: "00000000-0000-0000-0000-c00000000005", class_group_id: "00000000-0000-0000-0000-a00000000005", type: "summative",  date: "2025-10-20", max_points: 30, weight: 2, matiere: "Histoire" },
    { id: "00000000-0000-0000-0000-e00000000019", title: "Analyse de sources — WWI",                course_id: "00000000-0000-0000-0000-c00000000005", class_group_id: "00000000-0000-0000-0000-a00000000005", type: "formative",  date: "2025-11-10", max_points: 20, weight: 1, matiere: "Histoire" },
    // Géographie — 3B
    { id: "00000000-0000-0000-0000-e00000000020", title: "Analyse de carte — L'Europe",             course_id: "00000000-0000-0000-0000-c00000000006", class_group_id: "00000000-0000-0000-0000-a00000000006", type: "summative",  date: "2025-10-28", max_points: 25, weight: 2, matiere: "Géographie" },
    { id: "00000000-0000-0000-0000-e00000000021", title: "Paysages et milieux naturels",            course_id: "00000000-0000-0000-0000-c00000000006", class_group_id: "00000000-0000-0000-0000-a00000000006", type: "formative",  date: "2025-11-28", max_points: 20, weight: 1, matiere: "Géographie" },
    // Anglais — 2B
    { id: "00000000-0000-0000-0000-e00000000022", title: "Reading comprehension — Daily life",       course_id: "00000000-0000-0000-0000-c00000000007", class_group_id: "00000000-0000-0000-0000-a00000000004", type: "formative",  date: "2025-10-14", max_points: 20, weight: 1, matiere: "Anglais" },
    { id: "00000000-0000-0000-0000-e00000000023", title: "Writing — My ideal school",               course_id: "00000000-0000-0000-0000-c00000000007", class_group_id: "00000000-0000-0000-0000-a00000000004", type: "summative",  date: "2025-11-22", max_points: 30, weight: 2, matiere: "Anglais" },
    // Néerlandais — 3A
    { id: "00000000-0000-0000-0000-e00000000024", title: "Compréhension écrite — B1.2 sprint",      course_id: "00000000-0000-0000-0000-c00000000001", class_group_id: "00000000-0000-0000-0000-a00000000005", type: "summative",  date: "2025-11-04", max_points: 40, weight: 3, matiere: "Néerlandais" },
    { id: "00000000-0000-0000-0000-e00000000025", title: "Expression écrite — Mon avenir",          course_id: "00000000-0000-0000-0000-c00000000001", class_group_id: "00000000-0000-0000-0000-a00000000005", type: "summative",  date: "2025-12-15", max_points: 35, weight: 2, matiere: "Néerlandais" },
    // Français — 1B
    { id: "00000000-0000-0000-0000-e00000000026", title: "Grammaire — Le présent de l'indicatif",   course_id: "00000000-0000-0000-0000-c00000000002", class_group_id: "00000000-0000-0000-0000-a00000000002", type: "formative",  date: "2025-10-06", max_points: 15, weight: 1, matiere: "Français" },
    { id: "00000000-0000-0000-0000-e00000000027", title: "Texte narratif — Mon héros",              course_id: "00000000-0000-0000-0000-c00000000002", class_group_id: "00000000-0000-0000-0000-a00000000002", type: "summative",  date: "2025-11-26", max_points: 35, weight: 2, matiere: "Français" },
    // Sciences — 1A
    { id: "00000000-0000-0000-0000-e00000000028", title: "Classification des êtres vivants",         course_id: "00000000-0000-0000-0000-c00000000004", class_group_id: "00000000-0000-0000-0000-a00000000001", type: "formative",  date: "2025-10-30", max_points: 20, weight: 1, matiere: "Sciences" },
    { id: "00000000-0000-0000-0000-e00000000029", title: "Examen mi-trimestre — Sciences",          course_id: "00000000-0000-0000-0000-c00000000004", class_group_id: "00000000-0000-0000-0000-a00000000001", type: "summative",  date: "2025-12-02", max_points: 40, weight: 3, matiere: "Sciences" },
    // Maths — 1B
    { id: "00000000-0000-0000-0000-e00000000030", title: "Nombres entiers et décimaux",             course_id: "00000000-0000-0000-0000-c00000000003", class_group_id: "00000000-0000-0000-0000-a00000000002", type: "formative",  date: "2025-10-09", max_points: 20, weight: 1, matiere: "Mathématiques" },
  ] as const;

  const LEVELS: ("NI" | "I" | "S" | "B" | "TB")[] = ["NI", "I", "S", "B", "TB"];
  const levelWeights = [0.1, 0.15, 0.35, 0.25, 0.15]; // distribution réaliste

  function pickLevel(): "NI" | "I" | "S" | "B" | "TB" {
    const r = Math.random();
    let cumul = 0;
    for (let i = 0; i < LEVELS.length; i++) {
      cumul += levelWeights[i];
      if (r < cumul) return LEVELS[i];
    }
    return "S";
  }

  const { error: evErr } = await supabaseAdmin.from("assessments").upsert(
    EVALS.map(ev => ({
      ...ev,
      school_id: DEMO_SCHOOL_ID,
      teacher_user_id: DEMO_USER_ID,
      teacher_id: DEMO_USER_ID,
      status: "published",
      parent_visible: true,
      weight: (ev as { weight?: number }).weight ?? 1,
    })),
    { onConflict: "id", ignoreDuplicates: false }
  );
  if (evErr) errors.push(`assessments: ${evErr.message}`);

  // ── 9. Résultats ─────────────────────────────────────────────────────────
  // Map: classe_id → évaluations pour cette classe
  const evalsByClass = new Map<string, typeof EVALS[number][]>();
  for (const ev of EVALS) {
    const arr = evalsByClass.get(ev.class_group_id) ?? [];
    arr.push(ev);
    evalsByClass.set(ev.class_group_id, arr);
  }

  const resultats: {
    id: string; school_id: string; academic_year_id: string; teacher_id: string;
    student_id: string; assessment_id: string; value: number; level: string;
  }[] = [];

  let resultIdx = 0;
  CLASS_GROUPS.forEach((cls, ci) => {
    const classEvals = evalsByClass.get(cls.id) ?? [];
    for (let si = 0; si < 5; si++) {
      const student = STUDENTS[ci * 5 + si];
      if (!student) continue;
      for (const ev of classEvals) {
        const level = pickLevel();
        const lvlScore = { NI: 0.3, I: 0.45, S: 0.62, B: 0.78, TB: 0.93 }[level];
        const value = Math.round(lvlScore * (ev.max_points ?? 20) * (0.9 + Math.random() * 0.2));
        resultats.push({
          id: `00000000-0000-0000-${ String(resultIdx).padStart(4, "0") }-r${String(resultIdx + 1).padStart(11, "0")}`,
          school_id: DEMO_SCHOOL_ID,
          academic_year_id: DEMO_YEAR_ID,
          teacher_id: DEMO_USER_ID,
          student_id: student.id,
          assessment_id: ev.id,
          value,
          level,
        });
        resultIdx++;
      }
    }
  });

  // Insérer par blocs de 50
  for (let i = 0; i < resultats.length; i += 50) {
    const chunk = resultats.slice(i, i + 50);
    const { error: rErr } = await supabaseAdmin.from("resultats").upsert(
      chunk, { onConflict: "id", ignoreDuplicates: false }
    );
    if (rErr) errors.push(`resultats[${i}]: ${rErr.message}`);
  }

  // ── 10. Remédiations ─────────────────────────────────────────────────────
  const REMEDIATIONS_TYPES = ["exercices_supplementaires", "soutien_individuel", "tutorat", "revision_lecon"];
  const ATTENDUS = [
    "L'élève identifie les mots-clés d'un texte en néerlandais",
    "L'élève conjugue correctement les verbes forts au présent",
    "L'élève résout des équations du premier degré",
    "L'élève identifie les réactifs et produits d'une réaction chimique",
    "L'élève utilise le vocabulaire de la vie quotidienne en néerlandais",
    "L'élève situe les événements de la Révolution française sur une frise chronologique",
    "L'élève rédige un texte narratif avec une introduction, un développement et une conclusion",
    "L'élève lit et analyse une carte géographique",
    "L'élève effectue des calculs sur les fractions",
    "L'élève comprend un document audio simple en anglais",
  ];

  // Remediations pour élèves NI/I
  const weakResults = resultats.filter(r => r.level === "NI" || r.level === "I").slice(0, 15);
  const demRemeds = weakResults.map((r, i) => ({
    id: `00000000-0000-0000-0000-d${String(i + 1).padStart(11, "0")}`,
    eleve_id: r.student_id,
    classe_id: CLASS_GROUPS.find(c =>
      EVALS.find(ev => ev.id === r.assessment_id)?.class_group_id === c.id
    )?.id ?? CLASS_GROUPS[0].id,
    assessment_id: r.assessment_id,
    attendu: ATTENDUS[i % ATTENDUS.length],
    type_remediation: REMEDIATIONS_TYPES[i % REMEDIATIONS_TYPES.length],
    origine: "evaluation",
    statut: (["Proposee", "En cours", "Terminee"] as const)[i % 3],
  }));

  if (demRemeds.length > 0) {
    const { error: remErr } = await supabaseAdmin.from("remediations").upsert(
      demRemeds, { onConflict: "id", ignoreDuplicates: false }
    );
    if (remErr) errors.push(`remediations: ${remErr.message}`);
  }

  // ── 11. Matière du prof démo ─────────────────────────────────────────────
  await supabaseAdmin.from("school_memberships")
    .update({ matiere: "Néerlandais" } as Record<string, unknown>)
    .eq("user_id", DEMO_USER_ID)
    .eq("school_id", DEMO_SCHOOL_ID);

  return NextResponse.json({
    ok: errors.length === 0,
    errors,
    stats: {
      courses: COURSES.length,
      classGroups: CLASS_GROUPS.length,
      students: STUDENTS.length,
      enrollments: enrollments.length,
      assessments: EVALS.length,
      resultats: resultats.length,
      remediations: demRemeds.length,
    },
  });
}

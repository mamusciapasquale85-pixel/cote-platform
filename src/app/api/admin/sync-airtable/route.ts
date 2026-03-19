import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const AIRTABLE_BASE_ID = "apptufHooDgBKNsNt";
const AIRTABLE_ELEVES_TABLE = "tblDdq2Sb3FOBYtVw";

const AIRTABLE_CLASS_IDS: Record<string, string> = {
  "3GTA":  "recL9EbNIRpe63gX4",
  "3GTIM": "recL1ZWxgttckyIZk",
  "3GTM":  "recInLyLzaTTttnBU",
  "3GTS":  "recsTkJH99PZ4hJMk",
  "3GTT":  "recBb2JGhaN6C14ir",
  "3GTU":  "recA395xWCdjHfyH4",
};

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}

async function airtableBatchCreate(
  apiKey: string,
  records: { fields: Record<string, unknown> }[]
): Promise<{ id: string }[]> {
  const results: { id: string }[] = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_ELEVES_TABLE}`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ records: batch }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Airtable error: ${JSON.stringify(err)}`);
    }
    const data = await res.json() as { records: { id: string }[] };
    results.push(...data.records);
    if (i + 10 < records.length) await new Promise(r => setTimeout(r, 250));
  }
  return results;
}

type StudentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  airtable_id: string | null;
};

type ClassRow = {
  student_id: string;
  class_group_id: string;
  class_groups: { name: string } | null;
};

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const airtableKey = process.env.AIRTABLE_API_KEY?.trim();
    if (!airtableKey) return NextResponse.json({ error: "AIRTABLE_API_KEY manquante dans .env.local" }, { status: 500 });

    // 1. Élèves sans airtable_id
    const { data: students, error: studentsErr } = await supabase
      .from("students")
      .select("id, first_name, last_name, airtable_id")
      .is("airtable_id", null);

    if (studentsErr) throw studentsErr;
    if (!students?.length) {
      return NextResponse.json({ message: "Tous les élèves ont déjà un airtable_id.", synced: 0 });
    }

    // 2. Classes des élèves (requête séparée pour éviter l'ambiguïté FK)
    const studentIds = (students as StudentRow[]).map(s => s.id);
    const { data: enrollments, error: enrollErr } = await supabase
      .from("student_enrollments")
      .select("student_id, class_group_id, class_groups(name)")
      .in("student_id", studentIds);

    if (enrollErr) throw enrollErr;

    // Map student_id → classe
    const classMap = new Map<string, string>();
    for (const enr of (enrollments ?? []) as unknown as ClassRow[]) {
      if (enr.student_id && enr.class_groups?.name) {
        classMap.set(enr.student_id, enr.class_groups.name);
      }
    }

    // 3. Préparer records Airtable
    const airtableRecords = (students as StudentRow[]).map(student => {
      const className = classMap.get(student.id);
      const classAirtableId = className ? AIRTABLE_CLASS_IDS[className] : undefined;
      return {
        studentId: student.id,
        airtableRecord: {
          fields: {
            "Nom de famille": student.last_name ?? "",
            "Prénom": student.first_name ?? "",
            ...(classAirtableId ? { "Classe": [classAirtableId] } : {}),
          } as Record<string, unknown>,
        },
      };
    });

    // 4. Créer dans Airtable
    const created = await airtableBatchCreate(airtableKey, airtableRecords.map(r => r.airtableRecord));

    // 5. Mettre à jour Supabase avec les airtable_id
    let updatedCount = 0;
    for (let i = 0; i < airtableRecords.length; i++) {
      const airtableId = created[i]?.id;
      if (!airtableId) continue;
      const { error: updateErr } = await supabase
        .from("students")
        .update({ airtable_id: airtableId })
        .eq("id", airtableRecords[i].studentId);
      if (!updateErr) updatedCount++;
      if (i % 10 === 9) await new Promise(r => setTimeout(r, 100));
    }

    return NextResponse.json({
      message: `✅ ${updatedCount} élèves créés dans Airtable et liés à Supabase.`,
      synced: updatedCount,
      total: students.length,
    });

  } catch (error: unknown) {
    return NextResponse.json({ error: toNiceError(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { data: stats } = await supabase.from("students").select("airtable_id");
    const total = stats?.length ?? 0;
    const synced = stats?.filter((s: { airtable_id: string | null }) => s.airtable_id).length ?? 0;
    return NextResponse.json({ total, synced, missing: total - synced, ready: total === synced });
  } catch (error: unknown) {
    return NextResponse.json({ error: toNiceError(error) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type UUID = string;

type PdfObject = {
  id: number;
  content: Buffer;
};

function normalizePdfText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(input: string, maxChars = 95): string[] {
  const text = input.trim();
  if (text.length <= maxChars) return [text];

  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = "";

  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length <= maxChars) {
      cur = next;
      continue;
    }
    if (cur) out.push(cur);
    cur = word;
  }

  if (cur) out.push(cur);
  return out;
}

function buildSimplePdf(linesInput: string[]): Buffer {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 50;
  const startY = 790;
  const lineHeight = 15;
  const maxLinesPerPage = Math.floor((startY - 60) / lineHeight);

  const wrapped = linesInput.flatMap((l) => wrapLine(l));
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += maxLinesPerPage) {
    pages.push(wrapped.slice(i, i + maxLinesPerPage));
  }
  if (pages.length === 0) pages.push([""]);

  const objects: PdfObject[] = [];
  let nextId = 1;

  const catalogId = nextId++;
  const pagesId = nextId++;

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];

  for (let i = 0; i < pages.length; i += 1) {
    pageObjectIds.push(nextId++);
    contentObjectIds.push(nextId++);
  }

  const fontId = nextId++;

  const contentStreams: string[] = pages.map((pageLines) => {
    const streamLines = ["BT", "/F1 12 Tf", `${lineHeight} TL`, `${marginX} ${startY} Td`];
    for (let i = 0; i < pageLines.length; i += 1) {
      streamLines.push(`(${normalizePdfText(pageLines[i])}) Tj`);
      if (i < pageLines.length - 1) streamLines.push("T*");
    }
    streamLines.push("ET");
    return `${streamLines.join("\n")}\n`;
  });

  objects.push({
    id: catalogId,
    content: Buffer.from(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`, "utf8"),
  });

  objects.push({
    id: pagesId,
    content: Buffer.from(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`, "utf8"),
  });

  for (let i = 0; i < pageObjectIds.length; i += 1) {
    objects.push({
      id: pageObjectIds[i],
      content: Buffer.from(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentObjectIds[i]} 0 R >>`,
        "utf8"
      ),
    });

    const stream = Buffer.from(contentStreams[i], "utf8");
    const header = Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "utf8");
    const footer = Buffer.from("endstream", "utf8");
    objects.push({ id: contentObjectIds[i], content: Buffer.concat([header, stream, footer]) });
  }

  objects.push({
    id: fontId,
    content: Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "utf8"),
  });

  objects.sort((a, b) => a.id - b.id);

  const header = Buffer.from("%PDF-1.4\n", "utf8");
  const bodyParts: Buffer[] = [header];
  const offsets: number[] = [0];
  let currentOffset = header.length;

  for (const obj of objects) {
    offsets[obj.id] = currentOffset;
    const prefix = Buffer.from(`${obj.id} 0 obj\n`, "utf8");
    const suffix = Buffer.from("\nendobj\n", "utf8");
    const full = Buffer.concat([prefix, obj.content, suffix]);
    bodyParts.push(full);
    currentOffset += full.length;
  }

  const xrefStart = currentOffset;
  const xrefLines = [`xref`, `0 ${objects.length + 1}`, `0000000000 65535 f `];
  for (let i = 1; i <= objects.length; i += 1) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }
  const xref = Buffer.from(`${xrefLines.join("\n")}\n`, "utf8");

  const trailer = Buffer.from(
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
    "utf8"
  );

  return Buffer.concat([...bodyParts, xref, trailer]);
}

function sanitizeFilenamePart(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-zA-Z0-9-_.]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const user = userData.user;
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const studentId = req.nextUrl.searchParams.get("student_id")?.trim() ?? "";
    if (!studentId) {
      return NextResponse.json({ error: "student_id manquant" }, { status: 400 });
    }

    const { data: membership, error: memErr } = await supabase
      .from("school_memberships")
      .select("school_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (memErr) throw memErr;
    if (!membership?.school_id) {
      return NextResponse.json({ error: "school_id introuvable" }, { status: 400 });
    }

    const schoolId = membership.school_id as UUID;

    const { data: ay, error: ayErr } = await supabase
      .from("academic_years")
      .select("id")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ayErr) throw ayErr;
    if (!ay?.id) {
      return NextResponse.json({ error: "Aucune année scolaire" }, { status: 400 });
    }

    const academicYearId = ay.id as UUID;

    const { data: student, error: stuErr } = await supabase
      .from("students")
      .select("id,first_name,last_name")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (stuErr) throw stuErr;
    if (!student) {
      return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
    }

    const { data: school, error: schoolErr } = await supabase
      .from("schools")
      .select("name")
      .eq("id", schoolId)
      .maybeSingle();
    if (schoolErr) throw schoolErr;

    const { data: enrollment, error: enrErr } = await supabase
      .from("student_enrollments")
      .select("class_group_id,class_groups(name,grade_level)")
      .eq("school_id", schoolId)
      .eq("academic_year_id", academicYearId)
      .eq("student_id", studentId)
      .limit(1)
      .maybeSingle();

    if (enrErr) throw enrErr;
    const classJoin = Array.isArray((enrollment as any)?.class_groups)
      ? (enrollment as any).class_groups[0]
      : (enrollment as any)?.class_groups;

    const classLabel = classJoin?.name
      ? `${classJoin.name}${classJoin.grade_level ? ` (niveau ${classJoin.grade_level})` : ""}`
      : "Classe non trouvée";

    const { data: rows, error: rowsErr } = await supabase
      .from("resultats")
      .select("value,level,created_at,assessments(title,date,max_points)")
      .eq("school_id", schoolId)
      .eq("academic_year_id", academicYearId)
      .eq("student_id", studentId)
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (rowsErr) throw rowsErr;

    const lines: string[] = [];
    lines.push("BULLETIN - V1");
    lines.push("");
    lines.push(`Ecole: ${school?.name ?? schoolId}`);
    lines.push(`Classe: ${classLabel}`);
    lines.push(`Eleve: ${student.last_name} ${student.first_name}`);
    lines.push(`Date generation: ${new Date().toISOString().slice(0, 10)}`);
    lines.push("");
    lines.push("Resultats:");

    if (!rows || rows.length === 0) {
      lines.push("Aucun resultat pour cet eleve.");
    } else {
      for (const row of rows as any[]) {
        const a = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments;
        const title = a?.title ?? "Evaluation";
        const date = a?.date ?? "";
        const maxPoints = typeof a?.max_points === "number" ? a.max_points : null;

        let gradePart = "-";
        if (row.value != null && maxPoints != null) gradePart = `${row.value}/${maxPoints}`;
        else if (row.value != null) gradePart = String(row.value);
        else if (row.level) gradePart = String(row.level);

        lines.push(`- ${title}${date ? ` (${date})` : ""}: ${gradePart}`);
      }
    }

    const pdfBuffer = buildSimplePdf(lines);
    const filename = `bulletin-${sanitizeFilenamePart(`${student.last_name}-${student.first_name}`) || "eleve"}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

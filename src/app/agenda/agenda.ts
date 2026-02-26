import { createClient } from "@/lib/supabase/client";

export type UUID = string;
export type AgendaType = "lesson" | "homework" | "test";
export type AssessmentType = "formative" | "summative";
export type ContentStatus = "draft" | "published" | "archived";

export type SlotNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const SLOTS: SlotNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DEFAULT_COURSE_NAME = "Néerlandais";

export type ClassGroup = {
  id: UUID;
  name: string;
  grade_level: number | null;
};

export type AgendaItem = {
  id: UUID;
  school_id: UUID;
  academic_year_id: UUID;
  teacher_id: UUID;
  class_group_id: UUID | null;
  date: string;
  slot: number | null;
  type: AgendaType;
  title: string;
  details: string | null;
  assessment_id: UUID | null;
  created_at: string;
  updated_at: string;
  class_groups?: ClassGroup | ClassGroup[] | null;
};

export type AgendaAssessment = {
  id: UUID;
  title: string;
  type: AssessmentType;
  status: ContentStatus;
  date: string;
  class_group_id: UUID | null;
  course_id: UUID | null;
};

export type ParsedScheduleCsvRow = {
  line: number;
  date: string;
  slot_raw: string;
  class_ref: string;
  course_name_raw: string;
  lesson_title_raw: string;
  tag_raw: string;
  details_raw: string;
};

export type ScheduleImportError = {
  line: number;
  message: string;
};

export type ScheduleImportSummary = {
  rowsTotal: number;
  rowsReady: number;
  created: number;
  updated: number;
  minDate: string | null;
  maxDate: string | null;
  minSlot: number | null;
  maxSlot: number | null;
  errors: ScheduleImportError[];
};

export type TeacherContext = {
  supabase: ReturnType<typeof createClient>;
  schoolId: UUID;
  academicYearId: UUID;
  teacherId: UUID;
};

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  CLASS_GROUPS: "class_groups",
  AGENDA_ITEMS: "agenda_items",
  ASSESSMENTS: "assessments",
} as const;

function errorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") return error.message;
  }
  return String(error);
}

function isMissingSlotColumn(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return msg.includes("slot") && msg.includes("does not exist");
}

function normalizeHeaderCell(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[/.]/g, "_")
    .replace(/[ -]+/g, "_");
}

function splitCsvLine(line: string, delimiter: "," | ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function countDelimiter(line: string, delimiter: "," | ";"): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') i += 1;
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) count += 1;
  }
  return count;
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const canonicalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/^\uFEFF/, "")
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const canonicalHeaders = headers.map(canonicalize);
  const canonicalCandidates = candidates.map(canonicalize);

  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx >= 0) return idx;
  }

  for (const c of canonicalCandidates) {
    const idx = canonicalHeaders.findIndex((h) => h === c || h.startsWith(`${c}_`));
    if (idx >= 0) return idx;
  }

  return -1;
}

function normalizeNameForMatch(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeClassToken(v: string): string {
  return v
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^A-Z0-9]/g, "");
}

function simplifyClassRef(v: string): string {
  return normalizeNameForMatch(v.replace(/\(([^)]*)\)/g, " "));
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

function pushMapArray(map: Map<string, UUID[]>, key: string, value: UUID): void {
  if (!key) return;
  const list = map.get(key);
  if (!list) {
    map.set(key, [value]);
    return;
  }
  if (!list.includes(value)) list.push(value);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const dt = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.toISOString().slice(0, 10) === value;
}

export function parseSlotRaw(raw: string): SlotNumber | null {
  const value = raw.trim().toUpperCase();
  if (!value) return null;
  const match = /^P?(10|[1-9])$/.exec(value);
  if (!match) return null;
  const n = Number(match[1]);
  if (n < 1 || n > 10) return null;
  return n as SlotNumber;
}

export function parseSlotValue(raw: unknown): SlotNumber | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isInteger(raw)) return parseSlotRaw(String(raw));
  if (typeof raw === "string") return parseSlotRaw(raw);
  return null;
}

function makeScheduleKey(input: {
  date: string;
  slot: SlotNumber;
  class_group_id: UUID;
}): string {
  return `${input.date}|${input.slot}|${input.class_group_id}`;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeClassGroup(joinValue: unknown): ClassGroup | null {
  if (!joinValue) return null;
  if (Array.isArray(joinValue)) return (joinValue[0] ?? null) as ClassGroup | null;
  return joinValue as ClassGroup;
}

function normalizeAgendaRow(row: any): AgendaItem {
  const slotNumber = parseSlotValue(row.slot);
  return {
    ...(row as AgendaItem),
    slot: slotNumber ?? null,
    assessment_id: row.assessment_id ?? null,
    class_groups: normalizeClassGroup((row as any).class_groups),
  };
}

export async function getTeacherContext(): Promise<TeacherContext> {
  const supabase = createClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Pas connecté");

  const { data: mem, error: memErr } = await supabase
    .from(T.SCHOOL_MEMBERSHIPS)
    .select("school_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memErr) throw memErr;
  if (!mem?.school_id) throw new Error("Impossible de trouver school_id (school_memberships).");

  const schoolId: UUID = mem.school_id;
  const teacherId: UUID = user.id;

  const { data: ay, error: ayErr } = await supabase
    .from(T.ACADEMIC_YEARS)
    .select("id")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ayErr) throw ayErr;
  if (!ay?.id) throw new Error("Aucune année scolaire trouvée (academic_years).");

  return { supabase, schoolId, academicYearId: ay.id as UUID, teacherId };
}

export async function listClassGroups(ctx: TeacherContext): Promise<ClassGroup[]> {
  const { data, error } = await ctx.supabase
    .from(T.CLASS_GROUPS)
    .select("id, name, grade_level")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ClassGroup[];
}

export function parseScheduleCsv(csvText: string): ParsedScheduleCsvRow[] {
  const text = csvText.replace(/^\uFEFF/, "");
  const lines = text.split(/\r\n|\n|\r/);
  const headerLineIndex = lines.findIndex((l) => l.trim().length > 0);
  if (headerLineIndex < 0) throw new Error("CSV vide.");

  const headerLine = lines[headerLineIndex];
  const delimiter: "," | ";" = countDelimiter(headerLine, ";") > countDelimiter(headerLine, ",") ? ";" : ",";
  const headers = splitCsvLine(headerLine, delimiter).map(normalizeHeaderCell);

  const idxDate = findHeaderIndex(headers, ["date", "jour_date", "jour", "date_cours"]);
  const idxSlot = findHeaderIndex(headers, ["slot", "creneau", "periode_horaire", "periode", "p"]);
  const idxClassId = findHeaderIndex(headers, ["class_group_id", "class_id"]);
  const idxClassName = findHeaderIndex(headers, ["class_name", "class", "classe", "groupe_classe"]);
  const idxCourseName = findHeaderIndex(headers, ["course_name", "course", "cours", "subject", "matiere", "title", "nom_cours"]);
  const idxLessonTitle = findHeaderIndex(headers, ["lesson_title", "lecon", "lecon_du_jour", "lesson"]);
  const idxTag = findHeaderIndex(headers, ["tag", "etiquette", "type_tag"]);
  const idxDetails = findHeaderIndex(headers, ["details", "detail", "note", "salle", "room"]);

  if (idxDate < 0) throw new Error("Colonne requise manquante: date (ou jour_date).");
  if (idxSlot < 0) throw new Error("Colonne requise manquante: slot/creneau/periode_horaire/p.");
  if (idxClassId < 0 && idxClassName < 0) throw new Error("Colonne classe manquante: class_group_id ou class_name.");
  // course_name est optionnel: fallback par défaut si colonne absente.

  const rows: ParsedScheduleCsvRow[] = [];
  for (let i = headerLineIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    const cols = splitCsvLine(line, delimiter);

    rows.push({
      line: i + 1,
      date: (cols[idxDate] ?? "").trim(),
      slot_raw: (cols[idxSlot] ?? "").trim(),
      class_ref:
        (idxClassId >= 0 ? (cols[idxClassId] ?? "").trim() : "") ||
        (idxClassName >= 0 ? (cols[idxClassName] ?? "").trim() : ""),
      course_name_raw: idxCourseName >= 0 ? (cols[idxCourseName] ?? "").trim() : "",
      lesson_title_raw: idxLessonTitle >= 0 ? (cols[idxLessonTitle] ?? "").trim() : "",
      tag_raw: idxTag >= 0 ? (cols[idxTag] ?? "").trim() : "",
      details_raw: idxDetails >= 0 ? (cols[idxDetails] ?? "").trim() : "",
    });
  }

  return rows;
}

type PreparedScheduleImportRow = {
  line: number;
  key: string;
  payload: {
    school_id: UUID;
    academic_year_id: UUID;
    teacher_id: UUID;
    class_group_id: UUID;
    date: string;
    slot: SlotNumber;
    type: "lesson";
    title: string;
    details: string | null;
  };
};

export async function importTeacherScheduleCsv(params: {
  ctx: TeacherContext;
  rows: ParsedScheduleCsvRow[];
  classes: ClassGroup[];
}): Promise<ScheduleImportSummary> {
  const { ctx, rows, classes } = params;

  const summary: ScheduleImportSummary = {
    rowsTotal: rows.length,
    rowsReady: 0,
    created: 0,
    updated: 0,
    minDate: null,
    maxDate: null,
    minSlot: null,
    maxSlot: null,
    errors: [],
  };

  const classById = new Map<string, UUID>();
  const classByName = new Map<string, UUID>();
  const classByToken = new Map<string, UUID[]>();
  const classNameById = new Map<UUID, string>();
  for (const c of classes) {
    classById.set(c.id.toLowerCase(), c.id);
    classByName.set(normalizeNameForMatch(c.name), c.id);
    pushMapArray(classByToken, normalizeClassToken(c.name), c.id);
    pushMapArray(classByToken, normalizeClassToken(simplifyClassRef(c.name)), c.id);
    classNameById.set(c.id, c.name);
  }

  const prepared: PreparedScheduleImportRow[] = [];

  for (const row of rows) {
    const date = row.date.trim();
    const slot = parseSlotRaw(row.slot_raw);
    const classRef = row.class_ref.trim();
    const courseName = row.course_name_raw.trim() || DEFAULT_COURSE_NAME;
    const lessonTitle = row.lesson_title_raw.trim();
    const detailsRaw = row.details_raw.trim();
    const tagRaw = row.tag_raw.trim().toLowerCase();

    if (!date || !isIsoDate(date)) {
      summary.errors.push({ line: row.line, message: `date invalide (${row.date || "vide"}). Format attendu: YYYY-MM-DD.` });
      continue;
    }
    if (!slot) {
      summary.errors.push({ line: row.line, message: `slot invalide (${row.slot_raw || "vide"}). Format attendu: P1..P10 ou 1..10.` });
      continue;
    }
    if (!classRef) {
      summary.errors.push({ line: row.line, message: "class_name manquant." });
      continue;
    }
    const classRefByName = normalizeNameForMatch(classRef);
    const classRefSimple = simplifyClassRef(classRef);
    const classRefToken = normalizeClassToken(classRef);

    let classId =
      classById.get(classRef.toLowerCase()) ??
      classByName.get(classRefByName) ??
      classByName.get(classRefSimple);

    if (!classId && classRefToken) {
      const tokenHits = classByToken.get(classRefToken) ?? [];
      if (tokenHits.length === 1) classId = tokenHits[0];
    }

    if (!classId) {
      const candidates = classes
        .map((c) => ({ id: c.id, norm: normalizeNameForMatch(c.name) }))
        .filter((c) => c.norm.startsWith(classRefSimple) || classRefSimple.startsWith(c.norm));
      if (candidates.length === 1) classId = candidates[0].id;
    }

    if (!classId && classRefToken) {
      const tokenCandidates = classes.map((c) => {
        const token = normalizeClassToken(c.name);
        return { id: c.id, token, dist: levenshteinDistance(classRefToken, token) };
      });
      tokenCandidates.sort((a, b) => a.dist - b.dist);
      const best = tokenCandidates[0];
      const second = tokenCandidates[1];
      if (
        best &&
        best.token &&
        best.dist <= 1 &&
        (!second || second.dist > best.dist)
      ) {
        classId = best.id;
      }
    }

    if (!classId) {
      summary.errors.push({ line: row.line, message: `classe introuvable (${classRef}).` });
      continue;
    }

    const className = classNameById.get(classId) ?? classRef;
    const tag = tagRaw === "eval" || tagRaw === "devoir" ? tagRaw : "";
    const detailsParts: string[] = [];
    if (lessonTitle) detailsParts.push(`Leçon: ${lessonTitle}`);
    if (tag) detailsParts.push(`Tag: ${tag}`);
    if (detailsRaw) detailsParts.push(detailsRaw);

    const payload = {
      school_id: ctx.schoolId,
      academic_year_id: ctx.academicYearId,
      teacher_id: ctx.teacherId,
      class_group_id: classId,
      date,
      slot,
      type: "lesson" as const,
      title: `${className} — ${courseName}`,
      details: detailsParts.length > 0 ? detailsParts.join(" | ") : null,
    };

    prepared.push({
      line: row.line,
      key: makeScheduleKey({ date, slot, class_group_id: classId }),
      payload,
    });

    if (!summary.minDate || date < summary.minDate) summary.minDate = date;
    if (!summary.maxDate || date > summary.maxDate) summary.maxDate = date;
    if (summary.minSlot == null || slot < summary.minSlot) summary.minSlot = slot;
    if (summary.maxSlot == null || slot > summary.maxSlot) summary.maxSlot = slot;
  }

  summary.rowsReady = prepared.length;
  if (prepared.length === 0) return summary;

  const dates = Array.from(new Set(prepared.map((p) => p.payload.date)));
  const slots = Array.from(new Set(prepared.map((p) => p.payload.slot)));
  const classIds = Array.from(new Set(prepared.map((p) => p.payload.class_group_id)));

  let existingQuery = ctx.supabase
    .from(T.AGENDA_ITEMS)
    .select("id,date,slot,class_group_id,title,details")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("type", "lesson");

  if (dates.length > 0) existingQuery = existingQuery.in("date", dates);
  if (slots.length > 0) existingQuery = existingQuery.in("slot", slots);
  if (classIds.length > 0) existingQuery = existingQuery.in("class_group_id", classIds);

  const existing = await existingQuery;
  if (existing.error) {
    const msg = errorMessage(existing.error).toLowerCase();
    if (msg.includes("slot") && msg.includes("does not exist")) {
      throw new Error("Colonne agenda_items.slot absente. Applique la migration SQL des slots puis réessaie l'import.");
    }
    throw existing.error;
  }

  type ExistingScheduleRow = {
    id: UUID;
    date: string;
    slot: number | string | null;
    class_group_id: UUID | null;
    title: string | null;
    details: string | null;
  };

  const existingByKey = new Map<string, ExistingScheduleRow>();
  for (const row of existing.data ?? []) {
    const typed = row as ExistingScheduleRow;
    if (!typed.date || !typed.class_group_id || typed.slot == null) continue;
    const slotValue = parseSlotValue(row.slot);
    if (!slotValue) continue;

    const key = makeScheduleKey({
      date: String(typed.date),
      slot: slotValue as SlotNumber,
      class_group_id: typed.class_group_id as UUID,
    });
    existingByKey.set(key, typed);
  }

  const seenInCsv = new Set<string>();
  const toInsert: PreparedScheduleImportRow[] = [];
  const toUpdate: Array<{ id: UUID; title: string; details: string | null; line: number }> = [];
  for (const row of prepared) {
    const existingRow = existingByKey.get(row.key);
    if (seenInCsv.has(row.key)) {
      summary.errors.push({
        line: row.line,
        message: "Doublon dans le CSV (même date, slot et classe).",
      });
      continue;
    }
    seenInCsv.add(row.key);
    if (!existingRow) {
      toInsert.push(row);
      continue;
    }

    const sameTitle = (existingRow.title ?? "").trim() === row.payload.title;
    const sameDetails = (existingRow.details ?? "").trim() === (row.payload.details ?? "");
    if (sameTitle && sameDetails) continue;

    toUpdate.push({
      id: existingRow.id,
      title: row.payload.title,
      details: row.payload.details ?? null,
      line: row.line,
    });
  }

  if (toInsert.length === 0 && toUpdate.length === 0) return summary;

  for (const chunk of chunkArray(toInsert, 200)) {
    const bulk = await ctx.supabase.from(T.AGENDA_ITEMS).insert(chunk.map((r) => r.payload));
    if (!bulk.error) {
      summary.created += chunk.length;
      continue;
    }

    for (const row of chunk) {
      const single = await ctx.supabase.from(T.AGENDA_ITEMS).insert(row.payload);
      if (single.error) {
        summary.errors.push({ line: row.line, message: errorMessage(single.error) });
      } else {
        summary.created += 1;
      }
    }
  }

  for (const row of toUpdate) {
    const updated = await ctx.supabase
      .from(T.AGENDA_ITEMS)
      .update({ title: row.title, details: row.details })
      .eq("id", row.id)
      .eq("school_id", ctx.schoolId)
      .eq("academic_year_id", ctx.academicYearId)
      .eq("teacher_id", ctx.teacherId)
      .eq("type", "lesson");

    if (updated.error) {
      summary.errors.push({ line: row.line, message: errorMessage(updated.error) });
    } else {
      summary.updated += 1;
    }
  }

  return summary;
}

export async function listAgendaItems(params: {
  ctx: TeacherContext;
  dateFrom: string;
  dateTo: string;
  classGroupId?: UUID;
}): Promise<AgendaItem[]> {
  const { ctx, dateFrom, dateTo, classGroupId } = params;

  const runQuery = async (options: { includeSlot: boolean; includeAssessmentId: boolean }) => {
    const selectCols = [
      "id",
      "school_id",
      "academic_year_id",
      "teacher_id",
      "class_group_id",
      "date",
      options.includeSlot ? "slot" : null,
      "type",
      "title",
      "details",
      options.includeAssessmentId ? "assessment_id" : null,
      "created_at",
      "updated_at",
      "class_groups ( id, name, grade_level )",
    ]
      .filter(Boolean)
      .join(", ");

    let query = ctx.supabase
      .from(T.AGENDA_ITEMS)
      .select(selectCols)
      .eq("school_id", ctx.schoolId)
      .eq("academic_year_id", ctx.academicYearId)
      .eq("teacher_id", ctx.teacherId)
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: true });

    if (options.includeSlot) {
      query = query.order("slot", { ascending: true });
    }

    query = query.order("created_at", { ascending: true });

    if (classGroupId) query = query.eq("class_group_id", classGroupId);
    return query;
  };

  let { data, error } = await runQuery({ includeSlot: true, includeAssessmentId: true });
  if (error) {
    const msg = errorMessage(error).toLowerCase();
    const missingSlot = msg.includes("slot") && msg.includes("does not exist");
    const missingAssessment = msg.includes("assessment_id") && msg.includes("does not exist");

    if (missingSlot || missingAssessment) {
      const fallback = await runQuery({
        includeSlot: !missingSlot,
        includeAssessmentId: !missingAssessment,
      });
      if (fallback.error) throw fallback.error;
      data = (fallback.data ?? []).map((row: any) => ({
        ...row,
        slot: "slot" in row ? row.slot : null,
        assessment_id: "assessment_id" in row ? row.assessment_id : null,
      }));
      error = null;
    }
  }

  if (error) throw error;
  return ((data ?? []) as any[]).map(normalizeAgendaRow);
}

export async function listAssessmentsForAgenda(params: {
  ctx: TeacherContext;
  dateFrom: string;
  dateTo: string;
  classGroupId?: UUID;
}): Promise<AgendaAssessment[]> {
  const { ctx, dateFrom, dateTo, classGroupId } = params;

  let q = ctx.supabase
    .from(T.ASSESSMENTS)
    .select("id,title,type,status,date,class_group_id,course_id")
    .eq("school_id", ctx.schoolId)
    .eq("teacher_user_id", ctx.teacherId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (classGroupId) q = q.eq("class_group_id", classGroupId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AgendaAssessment[];
}

export async function upsertAgendaLesson(params: {
  ctx: TeacherContext;
  classGroupId: UUID;
  date: string;
  slot: SlotNumber;
  courseName: string;
  details: string | null;
}): Promise<void> {
  const { ctx, classGroupId, date, slot, courseName, details } = params;

  if (!isIsoDate(date)) throw new Error("Date invalide (YYYY-MM-DD attendu).");

  const existing = await ctx.supabase
    .from(T.AGENDA_ITEMS)
    .select("id")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("class_group_id", classGroupId)
    .eq("date", date)
    .eq("slot", slot)
    .eq("type", "lesson")
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    if (isMissingSlotColumn(existing.error)) {
      throw new Error("Colonne agenda_items.slot absente. Applique la migration SQL des slots puis réessaie.");
    }
    throw existing.error;
  }

  if (existing.data?.id) {
    const { error } = await ctx.supabase
      .from(T.AGENDA_ITEMS)
      .update({ title: courseName.trim(), details: details?.trim() || null })
      .eq("id", existing.data.id)
      .eq("school_id", ctx.schoolId)
      .eq("academic_year_id", ctx.academicYearId)
      .eq("teacher_id", ctx.teacherId);
    if (error) throw error;
    return;
  }

  const { error } = await ctx.supabase.from(T.AGENDA_ITEMS).insert({
    school_id: ctx.schoolId,
    academic_year_id: ctx.academicYearId,
    teacher_id: ctx.teacherId,
    class_group_id: classGroupId,
    date,
    slot,
    type: "lesson",
    title: courseName.trim(),
    details: details?.trim() || null,
  });

  if (error) {
    if (isMissingSlotColumn(error)) {
      throw new Error("Colonne agenda_items.slot absente. Applique la migration SQL des slots puis réessaie.");
    }
    throw error;
  }
}

export async function updateAgendaLessonDetails(params: {
  ctx: TeacherContext;
  itemId: UUID;
  details: string | null;
}): Promise<void> {
  const { ctx, itemId, details } = params;
  const { error } = await ctx.supabase
    .from(T.AGENDA_ITEMS)
    .update({ details: details?.trim() || null })
    .eq("id", itemId)
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("type", "lesson");

  if (error) throw error;
}

export async function deleteAgendaItem(params: { ctx: TeacherContext; id: UUID }): Promise<void> {
  const { ctx, id } = params;
  const { error } = await ctx.supabase
    .from(T.AGENDA_ITEMS)
    .delete()
    .eq("id", id)
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId);

  if (error) throw error;
}

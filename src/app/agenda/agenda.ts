import { createClient } from "@/lib/supabase/client";
import {
  type SlotNumber,
  SLOTS,
  parseSlotRaw,
  parseSlotValue,
  toSlotLabel,
  normalizeSlotLabel,
} from "./slot";

export type UUID = string;
export type AgendaType = "lesson" | "homework" | "test";
export type AssessmentType = "formative" | "summative";
export type ContentStatus = "draft" | "published" | "archived";

export type ClassGroup = {
  id: UUID;
  name: string;
  grade_level: number | null;
};

export type TeacherTimetableSlot = {
  id: UUID;
  school_id: UUID;
  academic_year_id: UUID;
  teacher_user_id: UUID;
  day_of_week: number; // 1=lundi ... 7=dimanche
  slot: SlotNumber;
  class_group_id: UUID | null;
  created_at: string;
  updated_at: string;
  class_groups?: ClassGroup | ClassGroup[] | null;
};

export type LessonNote = {
  id: UUID;
  school_id: UUID;
  academic_year_id: UUID;
  teacher_user_id: UUID;
  date: string;
  slot: SlotNumber;
  class_group_id: UUID;
  lesson_title: string | null;
  plan: string | null;
  comments: string | null;
  created_at: string;
  updated_at: string;
  class_groups?: ClassGroup | ClassGroup[] | null;
};

export type AgendaItem = {
  id: UUID;
  school_id: UUID;
  academic_year_id: UUID;
  teacher_id: UUID;
  class_group_id: UUID | null;
  date: string;
  slot: SlotNumber | null;
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

export type LessonScheduleRow = {
  id: UUID;
  date: string;
  slot: SlotNumber;
  class_group_id: UUID | null;
  title: string;
  details: string | null;
  lesson_title: string | null;
  tag: "eval" | "devoir" | null;
  class_groups?: ClassGroup | ClassGroup[] | null;
};

export type AgendaStudent = {
  id: UUID;
  first_name: string;
  last_name: string;
  student_ref?: string | null;
};

export type AttendanceStatus = "present" | "absent";

export type AttendanceRecord = {
  student_id: UUID;
  class_group_id: UUID;
  date: string;
  status: AttendanceStatus;
};

export type AttendancePeriodSummaryRow = {
  student_id: UUID;
  first_name: string;
  last_name: string;
  student_ref?: string | null;
  present_count: number;
  absent_count: number;
  total_marked: number;
};

export type AgendaQuickRemark = {
  id: UUID;
  student_id: UUID;
  text: string;
  created_at: string;
};

export type ParsedTimetableCsvRow = {
  line: number;
  day_of_week_raw: string;
  date_raw: string;
  slot_raw: string;
  slot_label: string;
  class_name_raw: string;
  lesson_title_raw: string;
  notes_raw: string;
  tag_raw: string;
  course_name_raw: string;
  // Compat with legacy /import page
  date: string;
  class_ref: string;
};

export type ScheduleImportError = {
  line: number;
  message: string;
};

export type TimetableImportSummary = {
  rowsTotal: number;
  rowsValid: number;
  rowsReady: number;
  created: number;
  updated: number;
  deleted: number;
  ignored: number;
  ignoredDuplicates: number;
  ignoredMissingClass: number;
  minDate: string | null;
  maxDate: string | null;
  minSlot: SlotNumber | null;
  maxSlot: SlotNumber | null;
  replaceWeekStart: string | null;
  replaceWeekEnd: string | null;
  errors: ScheduleImportError[];
};

export type TeacherContext = {
  supabase: ReturnType<typeof createClient>;
  schoolId: UUID;
  academicYearId: UUID;
  teacherId: UUID;
};

export { SLOTS, parseSlotRaw, parseSlotValue, toSlotLabel, normalizeSlotLabel };
export type { SlotNumber };

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  CLASS_GROUPS: "class_groups",
  TEACHER_TIMETABLE_SLOTS: "teacher_timetable_slots",
  LESSON_NOTES: "lesson_notes",
  AGENDA_ITEMS: "agenda_items",
  ASSESSMENTS: "assessments",
  STUDENT_ENROLLMENTS: "student_enrollments",
  STUDENTS: "students",
  ATTENDANCE_RECORDS: "attendance_records",
  REMARQUES: "remarques",
  DISCIPLINE_NOTES: "discipline_notes",
} as const;

function errorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") return error.message;
    if ("error_description" in error && typeof error.error_description === "string") return error.error_description;
  }
  return String(error);
}

function isMissingLessonNotesTable(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return msg.includes("lesson_notes") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

function isMissingStudentRefColumn(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return msg.includes("student_ref") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

function isMissingAttendanceTable(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return msg.includes("attendance_records") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

function isMissingRemarquesTable(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return msg.includes("remarques") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

function isMissingDisciplineNotesTable(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return msg.includes("discipline_notes") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

function isNoUniqueForOnConflict(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return msg.includes("no unique") || msg.includes("constraint matching");
}

function isMissingAgendaLessonColumns(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  const missingLessonTitle = msg.includes("lesson_title") && (msg.includes("schema cache") || msg.includes("does not exist"));
  const missingTag = msg.includes("tag") && (msg.includes("schema cache") || msg.includes("does not exist"));
  return missingLessonTitle || missingTag;
}

function normalizeTagValue(raw: string | null | undefined): "eval" | "devoir" | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value === "eval" || value === "evaluation" || value === "éval") return "eval";
  if (value === "devoir") return "devoir";
  if (value.includes("[eval]")) return "eval";
  if (value.includes("[devoir]")) return "devoir";
  return null;
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
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx >= 0) return idx;
  }
  return -1;
}

function normalizeNameForMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

function resolveClassByName(raw: string, classes: ClassGroup[]): ClassGroup | null {
  const normalized = normalizeNameForMatch(raw);
  if (!normalized) return null;

  const exact = classes.find((c) => normalizeNameForMatch(c.name) === normalized);
  if (exact) return exact;

  const scored: Array<{ c: ClassGroup; score: number }> = [];
  for (const c of classes) {
    const n = normalizeNameForMatch(c.name);
    if (!n) continue;
    if (normalized.startsWith(n) || n.startsWith(normalized)) scored.push({ c, score: n.length });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].c;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const dt = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.toISOString().slice(0, 10) === value;
}

function parseFrDateToIso(value: string): string | null {
  const v = value.trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isIsoDate(iso) ? iso : null;
}

function startOfIsoWeekMonday(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function parseDayOfWeekRaw(dayRaw: string, dateRaw?: string): number | null {
  const day = dayRaw.trim().toLowerCase();
  if (day) {
    if (/^[1-7]$/.test(day)) return Number(day);
    const map: Record<string, number> = {
      lun: 1,
      lundi: 1,
      mon: 1,
      monday: 1,
      mar: 2,
      mardi: 2,
      tue: 2,
      tuesday: 2,
      mer: 3,
      mercredi: 3,
      wed: 3,
      wednesday: 3,
      jeu: 4,
      jeudi: 4,
      thu: 4,
      thursday: 4,
      ven: 5,
      vendredi: 5,
      fri: 5,
      friday: 5,
      sam: 6,
      samedi: 6,
      sat: 6,
      saturday: 6,
      dim: 7,
      dimanche: 7,
      sun: 7,
      sunday: 7,
    };
    const mapped = map[day];
    if (mapped) return mapped;
  }

  const raw = (dateRaw ?? "").trim();
  if (!raw) return null;

  const iso = isIsoDate(raw) ? raw : parseFrDateToIso(raw);
  if (!iso) return null;
  const dt = new Date(`${iso}T12:00:00`);
  const dayOfWeek = dt.getDay();
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}

function normalizeClassGroup(joinValue: unknown): ClassGroup | null {
  if (!joinValue) return null;
  if (Array.isArray(joinValue)) return (joinValue[0] ?? null) as ClassGroup | null;
  return joinValue as ClassGroup;
}

function normalizeTimetableSlotRow(row: any): TeacherTimetableSlot {
  return {
    ...(row as TeacherTimetableSlot),
    day_of_week: Number(row.day_of_week),
    slot: parseSlotValue(row.slot) ?? 1,
    class_groups: normalizeClassGroup((row as any).class_groups),
  };
}

function normalizeLessonNoteRow(row: any): LessonNote {
  return {
    ...(row as LessonNote),
    slot: parseSlotValue(row.slot) ?? 1,
    class_groups: normalizeClassGroup((row as any).class_groups),
  };
}

function extractLegacyLessonTitle(details: string | null | undefined): string | null {
  if (!details) return null;
  const lines = String(details).split(/\r?\n/);
  const first = lines[0]?.trim() ?? "";
  if (!first) return null;
  const m = /^le[cç]on\s*:\s*(.+)$/i.exec(first);
  return m ? m[1].trim() : null;
}

function normalizeLessonScheduleRow(row: any): LessonScheduleRow {
  const normalizedTag = normalizeTagValue((row as any).tag ?? null);
  const legacyDetails = ((row as any).details ?? null) as string | null;
  const legacyLessonTitle = extractLegacyLessonTitle(legacyDetails);

  return {
    ...(row as LessonScheduleRow),
    slot: parseSlotValue((row as any).slot) ?? 1,
    lesson_title: (((row as any).lesson_title ?? null) as string | null) ?? legacyLessonTitle,
    tag: normalizedTag,
    class_groups: normalizeClassGroup((row as any).class_groups),
  };
}

function normalizeAgendaRow(row: any): AgendaItem {
  return {
    ...(row as AgendaItem),
    slot: parseSlotValue(row.slot),
    assessment_id: row.assessment_id ?? null,
    class_groups: normalizeClassGroup((row as any).class_groups),
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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

export function parseTimetableCsv(csvText: string): ParsedTimetableCsvRow[] {
  const text = csvText.replace(/^\uFEFF/, "");
  const lines = text.split(/\r\n|\n|\r/);
  const headerLineIndex = lines.findIndex((l) => l.trim().length > 0);
  if (headerLineIndex < 0) throw new Error("CSV vide.");

  const headerLine = lines[headerLineIndex];
  const delimiter: "," | ";" = countDelimiter(headerLine, ";") > countDelimiter(headerLine, ",") ? ";" : ",";
  const headers = splitCsvLine(headerLine, delimiter).map(normalizeHeaderCell);

  const idxDate = findHeaderIndex(headers, ["date", "jour_date"]);
  const idxSlot = findHeaderIndex(headers, ["slot", "creneau", "periode_horaire", "periode", "p"]);
  const idxClass = findHeaderIndex(headers, ["class_name", "class", "classe", "groupe_classe"]);
  const idxLesson = findHeaderIndex(headers, ["lesson_title", "lecon", "lecon_du_jour", "titre_lecon"]);
  const idxNotes = findHeaderIndex(headers, ["notes", "details", "note", "commentaires", "commentaire"]);
  const idxTag = findHeaderIndex(headers, ["tag", "type", "categorie"]);
  const idxCourse = findHeaderIndex(headers, ["course_name", "course", "cours", "matiere", "subject"]);

  // Import horaires prof: base minimale attendue (date + slot + class_name).
  if (idxDate < 0) throw new Error("Colonne requise manquante: date.");
  if (idxSlot < 0) throw new Error("Colonne requise manquante: slot/creneau/periode_horaire/p.");
  if (idxClass < 0) throw new Error("Colonne requise manquante: class_name/classe.");

  const rows: ParsedTimetableCsvRow[] = [];

  for (let i = headerLineIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    const cols = splitCsvLine(line, delimiter);

    const dateRaw = idxDate >= 0 ? (cols[idxDate] ?? "").trim() : "";
    const slotRaw = (cols[idxSlot] ?? "").trim();
    const classNameRaw = (cols[idxClass] ?? "").trim();
    const slotLabel = normalizeSlotLabel(slotRaw) ?? "";

    rows.push({
      line: i + 1,
      day_of_week_raw: "",
      date_raw: dateRaw,
      slot_raw: slotRaw,
      slot_label: slotLabel,
      class_name_raw: classNameRaw,
      lesson_title_raw: idxLesson >= 0 ? (cols[idxLesson] ?? "").trim() : "",
      notes_raw: idxNotes >= 0 ? (cols[idxNotes] ?? "").trim() : "",
      tag_raw: idxTag >= 0 ? (cols[idxTag] ?? "").trim() : "",
      course_name_raw: idxCourse >= 0 ? (cols[idxCourse] ?? "").trim() : "",
      date: dateRaw,
      class_ref: classNameRaw,
    });
  }

  return rows;
}

type PreparedTimetableImportRow = {
  line: number;
  key: string;
  date: string;
  slot: SlotNumber;
  payload: {
    school_id: UUID;
    academic_year_id: UUID;
    teacher_id: UUID;
    date: string;
    slot: number;
    class_group_id: UUID;
    type: "lesson";
    title: string;
    lesson_title: string | null;
    details: string | null;
    tag: "eval" | "devoir" | null;
  };
};

export async function importTeacherTimetableCsv(params: {
  ctx: TeacherContext;
  rows: ParsedTimetableCsvRow[];
  classes: ClassGroup[];
}): Promise<TimetableImportSummary> {
  const { ctx, rows, classes } = params;

  const summary: TimetableImportSummary = {
    rowsTotal: rows.length,
    rowsValid: 0,
    rowsReady: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    ignored: 0,
    ignoredDuplicates: 0,
    ignoredMissingClass: 0,
    minDate: null,
    maxDate: null,
    minSlot: null,
    maxSlot: null,
    replaceWeekStart: null,
    replaceWeekEnd: null,
    errors: [],
  };

  const preparedByKey = new Map<string, PreparedTimetableImportRow>();

  for (const row of rows) {
    const isoDateRaw = row.date_raw.trim();
    if (!isIsoDate(isoDateRaw)) {
      summary.errors.push({ line: row.line, message: `date invalide (${row.date_raw || "vide"}). Attendu: YYYY-MM-DD.` });
      summary.ignored += 1;
      continue;
    }

    const slotLabel = row.slot_label || normalizeSlotLabel(row.slot_raw);
    if (!slotLabel) {
      summary.errors.push({
        line: row.line,
        message: "slot invalide (attendu P1..P10 ou 1..10)",
      });
      summary.ignored += 1;
      continue;
    }
    const slot = parseSlotRaw(slotLabel);
    if (!slot) {
      summary.errors.push({
        line: row.line,
        message: "slot invalide (attendu P1..P10 ou 1..10)",
      });
      summary.ignored += 1;
      continue;
    }

    const classNameRaw = row.class_name_raw.trim();
    if (!classNameRaw) {
      summary.ignoredMissingClass += 1;
      summary.ignored += 1;
      continue;
    }

    // Correction legacy: certains CSV exportés contiennent "3GTIMM" au lieu de "3GTIM".
    const classNameForLookup = normalizeNameForMatch(classNameRaw) === "3gtimm" ? "3GTIM" : classNameRaw;
    const classMatch = resolveClassByName(classNameForLookup, classes);
    if (!classMatch) {
      summary.errors.push({ line: row.line, message: `classe introuvable (${classNameRaw}).` });
      summary.ignored += 1;
      continue;
    }

    let isoDate = isoDateRaw;
    // Correction semaine type: les lignes "3GTIMM" (P9/P10) issues de l'ancien export
    // doivent être placées le mardi au lieu du mercredi.
    if (normalizeNameForMatch(classNameRaw) === "3gtimm" && (slot === 9 || slot === 10)) {
      const dow = new Date(`${isoDateRaw}T12:00:00`).getDay(); // 3 = mercredi
      if (dow === 3) {
        isoDate = addDaysIso(isoDateRaw, -1);
      }
    }

    const lessonTitle = row.lesson_title_raw.trim();
    const detailsText = row.notes_raw.trim();
    const tag = normalizeTagValue(row.tag_raw);
    const key = `${isoDate}|${slot}|${classMatch.id}`;
    if (preparedByKey.has(key)) {
      summary.ignoredDuplicates += 1;
      summary.ignored += 1;
      summary.errors.push({ line: row.line, message: "doublon CSV (date+slot+classe)." });
      continue;
    }

    preparedByKey.set(key, {
      line: row.line,
      key,
      date: isoDate,
      slot,
      payload: {
        school_id: ctx.schoolId,
        academic_year_id: ctx.academicYearId,
        teacher_id: ctx.teacherId,
        date: isoDate,
        slot,
        class_group_id: classMatch.id,
        type: "lesson",
        title: classMatch.name,
        lesson_title: lessonTitle || null,
        details: detailsText || null,
        tag,
      },
    });

    if (summary.minSlot == null || slot < summary.minSlot) summary.minSlot = slot;
    if (summary.maxSlot == null || slot > summary.maxSlot) summary.maxSlot = slot;
    if (!summary.minDate || isoDate < summary.minDate) summary.minDate = isoDate;
    if (!summary.maxDate || isoDate > summary.maxDate) summary.maxDate = isoDate;
  }

  const prepared = Array.from(preparedByKey.values());
  summary.rowsValid = prepared.length;
  summary.rowsReady = prepared.length;

  if (prepared.length === 0) return summary;

  const intervalStart = summary.minDate ?? prepared[0].date;
  const intervalEnd = summary.maxDate ?? prepared[prepared.length - 1]?.date ?? intervalStart;
  summary.replaceWeekStart = intervalStart;
  summary.replaceWeekEnd = intervalEnd;

  const runExistingQuery = async (includeLessonCols: boolean) => {
    const cols = includeLessonCols
      ? "id,date,slot,class_group_id,title,lesson_title,details,tag"
      : "id,date,slot,class_group_id,title,details";

    return ctx.supabase
      .from(T.AGENDA_ITEMS)
      .select(cols)
      .eq("school_id", ctx.schoolId)
      .eq("academic_year_id", ctx.academicYearId)
      .eq("teacher_id", ctx.teacherId)
      .eq("type", "lesson")
      .gte("date", intervalStart)
      .lte("date", intervalEnd)
      .order("date", { ascending: true })
      .order("slot", { ascending: true })
      .order("created_at", { ascending: true });
  };

  let existingRowsResult = await runExistingQuery(true);
  if (existingRowsResult.error && isMissingAgendaLessonColumns(existingRowsResult.error)) {
    existingRowsResult = await runExistingQuery(false);
  }
  if (existingRowsResult.error) throw existingRowsResult.error;

  type ExistingLessonRow = {
    id: UUID;
    date: string;
    slot: number | string | null;
    class_group_id: UUID | null;
    title: string | null;
    lesson_title?: string | null;
    details?: string | null;
    tag?: string | null;
  };

  const existingRows = (existingRowsResult.data ?? []) as unknown as ExistingLessonRow[];
  const existingByKey = new Map<string, ExistingLessonRow>();
  const duplicateExistingIds: UUID[] = [];

  for (const row of existingRows) {
    if (!row.class_group_id) continue;
    const slot = parseSlotValue(row.slot);
    if (!slot) continue;
    const key = `${row.date}|${slot}|${row.class_group_id}`;
    if (existingByKey.has(key)) {
      duplicateExistingIds.push(row.id);
      continue;
    }
    existingByKey.set(key, row);
  }

  const touchedExistingIds = new Set<UUID>();
  const preparedKeys = new Set(prepared.map((r) => r.key));
  const supportsLessonColumns = (existingRowsResult.data ?? []).some(
    (row: any) => Object.prototype.hasOwnProperty.call(row, "lesson_title") || Object.prototype.hasOwnProperty.call(row, "tag")
  );

  for (const row of prepared) {
    const existing = existingByKey.get(row.key);
    if (existing) {
      touchedExistingIds.add(existing.id);
      const existingLessonTitle = (existing.lesson_title ?? extractLegacyLessonTitle(existing.details)) ?? null;
      const existingTag = normalizeTagValue(existing.tag ?? existing.details ?? null);
      const hasDiff =
        (existing.title ?? "") !== row.payload.title ||
        (existing.details ?? null) !== row.payload.details ||
        (existingLessonTitle ?? null) !== row.payload.lesson_title ||
        (existingTag ?? null) !== row.payload.tag;

      if (!hasDiff) continue;

      const updatePayload: Record<string, unknown> = {
        title: row.payload.title,
        details: row.payload.details,
      };
      if (supportsLessonColumns) {
        updatePayload.lesson_title = row.payload.lesson_title;
        updatePayload.tag = row.payload.tag;
      }

      let updateResult = await ctx.supabase
        .from(T.AGENDA_ITEMS)
        .update(updatePayload)
        .eq("id", existing.id);

      if (updateResult.error && !supportsLessonColumns && isMissingAgendaLessonColumns(updateResult.error)) {
        updateResult = await ctx.supabase
          .from(T.AGENDA_ITEMS)
          .update({ title: row.payload.title, details: row.payload.details })
          .eq("id", existing.id);
      }

      if (updateResult.error) {
        summary.errors.push({ line: row.line, message: errorMessage(updateResult.error) });
        continue;
      }
      summary.updated += 1;
      continue;
    }

    const insertPayload: Record<string, unknown> = {
      school_id: row.payload.school_id,
      academic_year_id: row.payload.academic_year_id,
      teacher_id: row.payload.teacher_id,
      date: row.payload.date,
      slot: row.payload.slot,
      class_group_id: row.payload.class_group_id,
      type: "lesson",
      title: row.payload.title,
      details: row.payload.details,
      lesson_title: row.payload.lesson_title,
      tag: row.payload.tag,
    };

    let insertResult = await ctx.supabase.from(T.AGENDA_ITEMS).insert(insertPayload);
    if (insertResult.error && isMissingAgendaLessonColumns(insertResult.error)) {
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.lesson_title;
      delete fallbackPayload.tag;
      insertResult = await ctx.supabase.from(T.AGENDA_ITEMS).insert(fallbackPayload);
    }

    if (insertResult.error) {
      summary.errors.push({ line: row.line, message: errorMessage(insertResult.error) });
      continue;
    }
    summary.created += 1;
  }

  const idsToDelete: UUID[] = [...duplicateExistingIds];
  for (const [key, row] of existingByKey.entries()) {
    if (preparedKeys.has(key)) continue;
    if (touchedExistingIds.has(row.id)) continue;
    idsToDelete.push(row.id);
  }

  for (const chunk of chunkArray(idsToDelete, 200)) {
    if (chunk.length === 0) continue;
    const deleted = await ctx.supabase
      .from(T.AGENDA_ITEMS)
      .delete()
      .in("id", chunk);
    if (deleted.error) throw deleted.error;
    summary.deleted += chunk.length;
  }

  return summary;
}

export async function listLessonScheduleWeek(params: {
  ctx: TeacherContext;
  dateFrom: string;
  dateTo: string;
}): Promise<LessonScheduleRow[]> {
  const { ctx, dateFrom, dateTo } = params;

  const runQuery = async (includeLessonCols: boolean) => {
    const cols = includeLessonCols
      ? "id,date,slot,class_group_id,title,lesson_title,details,tag,class_groups(id,name,grade_level)"
      : "id,date,slot,class_group_id,title,details,class_groups(id,name,grade_level)";

    return ctx.supabase
      .from(T.AGENDA_ITEMS)
      .select(cols)
      .eq("school_id", ctx.schoolId)
      .eq("academic_year_id", ctx.academicYearId)
      .eq("teacher_id", ctx.teacherId)
      .eq("type", "lesson")
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: true })
      .order("slot", { ascending: true })
      .order("created_at", { ascending: true });
  };

  let result = await runQuery(true);
  if (result.error && isMissingAgendaLessonColumns(result.error)) {
    result = await runQuery(false);
  }

  if (result.error) throw result.error;
  return ((result.data ?? []) as any[]).map(normalizeLessonScheduleRow);
}

export async function listStudentsForClass(params: {
  ctx: TeacherContext;
  classGroupId: UUID;
}): Promise<AgendaStudent[]> {
  const { ctx, classGroupId } = params;
  const { data: enrollments, error: enrErr } = await ctx.supabase
    .from(T.STUDENT_ENROLLMENTS)
    .select("student_id")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("class_group_id", classGroupId);

  if (enrErr) throw enrErr;

  const studentIds = Array.from(
    new Set((enrollments ?? []).map((row: any) => row.student_id).filter(Boolean) as UUID[])
  );
  if (studentIds.length === 0) return [];

  const runQuery = async (includeStudentRef: boolean) => {
    const selectCols = includeStudentRef
      ? "id,first_name,last_name,student_ref"
      : "id,first_name,last_name";

    return ctx.supabase
      .from(T.STUDENTS)
      .select(selectCols)
      .eq("school_id", ctx.schoolId)
      .in("id", studentIds)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });
  };

  let { data: students, error: stuErr } = await runQuery(true);
  if (stuErr && isMissingStudentRefColumn(stuErr)) {
    const fallback = await runQuery(false);
    if (fallback.error) throw fallback.error;
    students = (fallback.data ?? []).map((row: any) => ({ ...row, student_ref: null }));
    stuErr = null;
  }

  if (stuErr) throw stuErr;
  return (students ?? []) as unknown as AgendaStudent[];
}

export async function upsertLessonScheduleCell(params: {
  ctx: TeacherContext;
  date: string;
  slot: SlotNumber;
  classGroupId: UUID;
  className: string;
  lessonTitle: string | null;
  details: string | null;
  tag?: string | null;
}): Promise<void> {
  const { ctx, date, slot, classGroupId, className, lessonTitle, details } = params;
  const tag = normalizeTagValue(params.tag ?? null);
  if (!isIsoDate(date)) throw new Error("Date invalide (YYYY-MM-DD attendu).");

  const existing = await ctx.supabase
    .from(T.AGENDA_ITEMS)
    .select("id,class_group_id")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("type", "lesson")
    .eq("date", date)
    .eq("slot", slot);
  if (existing.error) throw existing.error;

  const existingRows = (existing.data ?? []) as Array<{ id: UUID; class_group_id: UUID | null }>;
  const matching = existingRows.find((row) => row.class_group_id === classGroupId) ?? null;
  const duplicateIds = existingRows
    .filter((row) => !matching || row.id !== matching.id)
    .map((row) => row.id);

  const payloadWithColumns: Record<string, unknown> = {
    school_id: ctx.schoolId,
    academic_year_id: ctx.academicYearId,
    teacher_id: ctx.teacherId,
    class_group_id: classGroupId,
    date,
    slot,
    type: "lesson",
    title: className,
    lesson_title: lessonTitle?.trim() || null,
    details: details?.trim() || null,
    tag,
  };

  if (matching) {
    let update = await ctx.supabase
      .from(T.AGENDA_ITEMS)
      .update(payloadWithColumns)
      .eq("id", matching.id);
    if (update.error && isMissingAgendaLessonColumns(update.error)) {
      const fallbackPayload = { ...payloadWithColumns };
      delete fallbackPayload.lesson_title;
      delete fallbackPayload.tag;
      update = await ctx.supabase
        .from(T.AGENDA_ITEMS)
        .update(fallbackPayload)
        .eq("id", matching.id);
    }
    if (update.error) throw update.error;
  } else {
    let insert = await ctx.supabase.from(T.AGENDA_ITEMS).insert(payloadWithColumns);
    if (insert.error && isMissingAgendaLessonColumns(insert.error)) {
      const fallbackPayload = { ...payloadWithColumns };
      delete fallbackPayload.lesson_title;
      delete fallbackPayload.tag;
      insert = await ctx.supabase.from(T.AGENDA_ITEMS).insert(fallbackPayload);
    }
    if (insert.error) throw insert.error;
  }

  if (duplicateIds.length > 0) {
    const deleted = await ctx.supabase.from(T.AGENDA_ITEMS).delete().in("id", duplicateIds);
    if (deleted.error) throw deleted.error;
  }
}

export async function listAttendanceForClassDate(params: {
  ctx: TeacherContext;
  classGroupId: UUID;
  date: string;
}): Promise<AttendanceRecord[]> {
  const { ctx, classGroupId, date } = params;
  const { data, error } = await ctx.supabase
    .from(T.ATTENDANCE_RECORDS)
    .select("student_id,class_group_id,date,status")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("class_group_id", classGroupId)
    .eq("date", date);

  if (error) {
    if (isMissingAttendanceTable(error)) return [];
    throw error;
  }
  return (data ?? []) as AttendanceRecord[];
}

export async function upsertAttendanceForClassDate(params: {
  ctx: TeacherContext;
  classGroupId: UUID;
  date: string;
  rows: Array<{ studentId: UUID; absent: boolean }>;
}): Promise<void> {
  const { ctx, classGroupId, date, rows } = params;
  if (!isIsoDate(date)) throw new Error("Date invalide (YYYY-MM-DD attendu).");
  if (rows.length === 0) return;

  const payload = rows.map((row) => ({
    school_id: ctx.schoolId,
    academic_year_id: ctx.academicYearId,
    teacher_id: ctx.teacherId,
    class_group_id: classGroupId,
    student_id: row.studentId,
    date,
    status: row.absent ? "absent" : "present",
  }));

  const upsertResult = await ctx.supabase
    .from(T.ATTENDANCE_RECORDS)
    .upsert(payload, { onConflict: "student_id,class_group_id,date" });

  if (!upsertResult.error) return;

  if (isMissingAttendanceTable(upsertResult.error)) {
    throw new Error("Table attendance_records absente. Applique la migration SQL puis réessaie.");
  }

  if (!isNoUniqueForOnConflict(upsertResult.error)) throw upsertResult.error;

  // Fallback si la contrainte unique n'existe pas encore dans certains environnements.
  const studentIds = Array.from(new Set(rows.map((r) => r.studentId)));
  const deleted = await ctx.supabase
    .from(T.ATTENDANCE_RECORDS)
    .delete()
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("class_group_id", classGroupId)
    .eq("date", date)
    .in("student_id", studentIds);
  if (deleted.error) throw deleted.error;

  const inserted = await ctx.supabase
    .from(T.ATTENDANCE_RECORDS)
    .insert(payload);
  if (inserted.error) throw inserted.error;
}

export async function listAttendanceSummaryForClassPeriod(params: {
  ctx: TeacherContext;
  classGroupId: UUID;
  dateFrom: string;
  dateTo: string;
}): Promise<AttendancePeriodSummaryRow[]> {
  const { ctx, classGroupId, dateFrom, dateTo } = params;
  const students = await listStudentsForClass({ ctx, classGroupId });
  if (students.length === 0) return [];

  const { data, error } = await ctx.supabase
    .from(T.ATTENDANCE_RECORDS)
    .select("student_id,status")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("class_group_id", classGroupId)
    .gte("date", dateFrom)
    .lte("date", dateTo);

  if (error) {
    if (isMissingAttendanceTable(error)) return students.map((s) => ({
      student_id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      student_ref: s.student_ref ?? null,
      present_count: 0,
      absent_count: 0,
      total_marked: 0,
    }));
    throw error;
  }

  const counts = new Map<UUID, { present: number; absent: number }>();
  for (const row of (data ?? []) as Array<{ student_id: UUID; status: AttendanceStatus }>) {
    const current = counts.get(row.student_id) ?? { present: 0, absent: 0 };
    if (row.status === "absent") current.absent += 1;
    else current.present += 1;
    counts.set(row.student_id, current);
  }

  return students.map((student) => {
    const c = counts.get(student.id) ?? { present: 0, absent: 0 };
    return {
      student_id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      student_ref: student.student_ref ?? null,
      present_count: c.present,
      absent_count: c.absent,
      total_marked: c.present + c.absent,
    };
  });
}

export async function listQuickRemarquesForStudent(params: {
  ctx: TeacherContext;
  studentId: UUID;
  limit?: number;
}): Promise<AgendaQuickRemark[]> {
  const { ctx, studentId, limit = 5 } = params;
  if (!studentId) return [];

  const fromRemarques = await ctx.supabase
    .from(T.REMARQUES)
    .select("id,student_id,text,created_at")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!fromRemarques.error) {
    return (fromRemarques.data ?? []) as AgendaQuickRemark[];
  }

  if (!isMissingRemarquesTable(fromRemarques.error)) {
    throw fromRemarques.error;
  }

  const fromDiscipline = await ctx.supabase
    .from(T.DISCIPLINE_NOTES)
    .select("id,student_id,note,created_at,date")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_user_id", ctx.teacherId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (fromDiscipline.error) {
    if (isMissingDisciplineNotesTable(fromDiscipline.error)) return [];
    throw fromDiscipline.error;
  }

  return (fromDiscipline.data ?? []).map((row: any) => ({
    id: row.id as UUID,
    student_id: row.student_id as UUID,
    text: String(row.note ?? "").trim(),
    created_at: (row.created_at as string | null) ?? `${String(row.date)}T00:00:00.000Z`,
  }));
}

export async function createQuickRemarque(params: {
  ctx: TeacherContext;
  studentId: UUID;
  text: string;
}): Promise<void> {
  const { ctx, studentId } = params;
  const text = params.text.trim();
  if (!studentId) throw new Error("Élève obligatoire.");
  if (!text) throw new Error("Remarque vide.");

  const toRemarques = await ctx.supabase.from(T.REMARQUES).insert({
    school_id: ctx.schoolId,
    academic_year_id: ctx.academicYearId,
    teacher_id: ctx.teacherId,
    student_id: studentId,
    type: "discipline",
    text,
  });

  if (!toRemarques.error) return;
  if (!isMissingRemarquesTable(toRemarques.error)) throw toRemarques.error;

  const today = new Date().toISOString().slice(0, 10);
  const toDiscipline = await ctx.supabase.from(T.DISCIPLINE_NOTES).insert({
    school_id: ctx.schoolId,
    academic_year_id: ctx.academicYearId,
    teacher_user_id: ctx.teacherId,
    student_id: studentId,
    date: today,
    note: text,
  });

  if (toDiscipline.error) {
    if (isMissingDisciplineNotesTable(toDiscipline.error)) {
      throw new Error("Aucune table de remarques disponible (remarques / discipline_notes).");
    }
    throw toDiscipline.error;
  }
}

export async function listTimetableWeek(params: {
  ctx: TeacherContext;
  classGroupId?: UUID;
}): Promise<TeacherTimetableSlot[]> {
  const { ctx, classGroupId } = params;

  let query = ctx.supabase
    .from(T.TEACHER_TIMETABLE_SLOTS)
    .select("id,school_id,academic_year_id,teacher_user_id,day_of_week,slot,class_group_id,created_at,updated_at,class_groups(id,name,grade_level)")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_user_id", ctx.teacherId)
    .order("day_of_week", { ascending: true })
    .order("slot", { ascending: true });

  if (classGroupId) query = query.eq("class_group_id", classGroupId);

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as any[]).map(normalizeTimetableSlotRow);
}

export async function upsertTimetableSlot(params: {
  ctx: TeacherContext;
  dayOfWeek: number;
  slot: SlotNumber;
  classGroupId: UUID | null;
}): Promise<void> {
  const { ctx, dayOfWeek, slot, classGroupId } = params;

  if (!dayOfWeek || dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error("Jour invalide. Valeur attendue: 1..7.");
  }

  const { error } = await ctx.supabase
    .from(T.TEACHER_TIMETABLE_SLOTS)
    .upsert(
      {
        school_id: ctx.schoolId,
        academic_year_id: ctx.academicYearId,
        teacher_user_id: ctx.teacherId,
        day_of_week: dayOfWeek,
        slot,
        class_group_id: classGroupId,
      },
      {
        onConflict: "teacher_user_id,academic_year_id,day_of_week,slot",
        ignoreDuplicates: false,
      }
    );

  if (error) throw error;
}

export async function listLessonNotesWeek(params: {
  ctx: TeacherContext;
  dateFrom: string;
  dateTo: string;
  classGroupId?: UUID;
}): Promise<LessonNote[]> {
  const { ctx, dateFrom, dateTo, classGroupId } = params;

  let query = ctx.supabase
    .from(T.LESSON_NOTES)
    .select("id,school_id,academic_year_id,teacher_user_id,date,slot,class_group_id,lesson_title,plan,comments,created_at,updated_at,class_groups(id,name,grade_level)")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_user_id", ctx.teacherId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true })
    .order("slot", { ascending: true });

  if (classGroupId) query = query.eq("class_group_id", classGroupId);

  const { data, error } = await query;
  if (error) {
    if (isMissingLessonNotesTable(error)) return [];
    throw error;
  }

  return ((data ?? []) as any[]).map(normalizeLessonNoteRow);
}

export async function getLessonNote(params: {
  ctx: TeacherContext;
  date: string;
  slot: SlotNumber;
}): Promise<LessonNote | null> {
  const { ctx, date, slot } = params;

  const { data, error } = await ctx.supabase
    .from(T.LESSON_NOTES)
    .select("id,school_id,academic_year_id,teacher_user_id,date,slot,class_group_id,lesson_title,plan,comments,created_at,updated_at,class_groups(id,name,grade_level)")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_user_id", ctx.teacherId)
    .eq("date", date)
    .eq("slot", slot)
    .maybeSingle();

  if (error) {
    if (isMissingLessonNotesTable(error)) return null;
    throw error;
  }
  return data ? normalizeLessonNoteRow(data) : null;
}

export async function upsertLessonNote(params: {
  ctx: TeacherContext;
  date: string;
  slot: SlotNumber;
  classGroupId: UUID;
  lessonTitle: string | null;
  plan: string | null;
  comments: string | null;
}): Promise<void> {
  const { ctx, date, slot, classGroupId, lessonTitle, plan, comments } = params;

  if (!isIsoDate(date)) throw new Error("Date invalide (YYYY-MM-DD attendu).");

  const { error } = await ctx.supabase
    .from(T.LESSON_NOTES)
    .upsert(
      {
        school_id: ctx.schoolId,
        academic_year_id: ctx.academicYearId,
        teacher_user_id: ctx.teacherId,
        date,
        slot,
        class_group_id: classGroupId,
        lesson_title: lessonTitle?.trim() || null,
        plan: plan?.trim() || null,
        comments: comments?.trim() || null,
      },
      {
        onConflict: "teacher_user_id,date,slot",
        ignoreDuplicates: false,
      }
    );

  if (error) {
    if (isMissingLessonNotesTable(error)) {
      throw new Error("Table lesson_notes absente. Applique la migration SQL puis réessaie.");
    }
    throw error;
  }
}

export async function listAgendaItems(params: {
  ctx: TeacherContext;
  dateFrom: string;
  dateTo: string;
  classGroupId?: UUID;
}): Promise<AgendaItem[]> {
  const { ctx, dateFrom, dateTo, classGroupId } = params;

  const runQuery = async (includeAssessmentId: boolean) => {
    const cols = [
      "id",
      "school_id",
      "academic_year_id",
      "teacher_id",
      "class_group_id",
      "date",
      "slot",
      "type",
      "title",
      "details",
      includeAssessmentId ? "assessment_id" : null,
      "created_at",
      "updated_at",
      "class_groups(id,name,grade_level)",
    ]
      .filter(Boolean)
      .join(",");

    let query = ctx.supabase
      .from(T.AGENDA_ITEMS)
      .select(cols)
      .eq("school_id", ctx.schoolId)
      .eq("academic_year_id", ctx.academicYearId)
      .eq("teacher_id", ctx.teacherId)
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: true })
      .order("slot", { ascending: true })
      .order("created_at", { ascending: true });

    if (classGroupId) query = query.eq("class_group_id", classGroupId);
    return query;
  };

  let { data, error } = await runQuery(true);
  if (error) {
    const msg = errorMessage(error).toLowerCase();
    if (msg.includes("assessment_id") && msg.includes("does not exist")) {
      const fallback = await runQuery(false);
      if (fallback.error) throw fallback.error;
      data = (fallback.data ?? []).map((row: any) => ({ ...row, assessment_id: null }));
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
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (classGroupId) q = q.eq("class_group_id", classGroupId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AgendaAssessment[];
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

export async function updateAgendaEvent(params: {
  ctx: TeacherContext;
  itemId: UUID;
  title: string;
  details: string | null;
}): Promise<void> {
  const { ctx, itemId, title, details } = params;
  const { error } = await ctx.supabase
    .from(T.AGENDA_ITEMS)
    .update({ title: title.trim(), details: details?.trim() || null })
    .eq("id", itemId)
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .in("type", ["homework", "test"]);

  if (error) throw error;
}

// ----------------------------------------------------------------------------
// Backward-compatible aliases used by existing /import module.
// ----------------------------------------------------------------------------
export type ParsedScheduleCsvRow = ParsedTimetableCsvRow;
export type ScheduleImportSummary = TimetableImportSummary;

export const parseScheduleCsv = parseTimetableCsv;

export async function importTeacherScheduleCsv(params: {
  ctx: TeacherContext;
  rows: ParsedScheduleCsvRow[];
  classes: ClassGroup[];
}): Promise<ScheduleImportSummary> {
  return importTeacherTimetableCsv({
    ctx: params.ctx,
    rows: params.rows,
    classes: params.classes,
  });
}

export const listTeacherTimetableWeek = listTimetableWeek;
export const upsertTeacherTimetableSlot = upsertTimetableSlot;

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
  class_groups?: ClassGroup | ClassGroup[] | null;
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
  inserted: number;
  deletedPrevious: number;
  created: number;
  updated: number;
  ignoredDuplicates: number;
  ignoredMissingClass: number;
  minDate: string | null;
  maxDate: string | null;
  minSlot: number | null;
  maxSlot: number | null;
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
    details: string | null;
  };
};

export async function importTeacherTimetableCsv(params: {
  ctx: TeacherContext;
  rows: ParsedTimetableCsvRow[];
  classes: ClassGroup[];
  weekStartIso?: string;
}): Promise<TimetableImportSummary> {
  const { ctx, rows, classes, weekStartIso } = params;

  const summary: TimetableImportSummary = {
    rowsTotal: rows.length,
    rowsValid: 0,
    rowsReady: 0,
    inserted: 0,
    deletedPrevious: 0,
    created: 0,
    updated: 0,
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

  const preparedRaw: PreparedTimetableImportRow[] = [];

  for (const row of rows) {
    const isoDate = row.date_raw.trim();
    if (!isIsoDate(isoDate)) {
      summary.errors.push({ line: row.line, message: `date invalide (${row.date_raw || "vide"}). Attendu: YYYY-MM-DD.` });
      continue;
    }

    const slotLabel = row.slot_label || normalizeSlotLabel(row.slot_raw);
    if (!slotLabel) {
      summary.errors.push({
        line: row.line,
        message: "slot invalide (attendu P1..P10 ou 1..10)",
      });
      continue;
    }
    const slot = parseSlotRaw(slotLabel);
    if (!slot) {
      summary.errors.push({
        line: row.line,
        message: "slot invalide (attendu P1..P10 ou 1..10)",
      });
      continue;
    }

    const className = row.class_name_raw.trim();
    if (!className) {
      summary.ignoredMissingClass += 1;
      continue;
    }

    const classMatch = resolveClassByName(className, classes);
    if (!classMatch) {
      summary.errors.push({ line: row.line, message: `classe introuvable (${className}).` });
      continue;
    }

    const detailsParts: string[] = [];
    const lessonTitle = row.lesson_title_raw.trim();
    const detailsText = row.notes_raw.trim();
    const tagText = row.tag_raw.trim();
    if (lessonTitle) detailsParts.push(`Leçon: ${lessonTitle}`);
    if (detailsText) detailsParts.push(detailsText);
    if (tagText) detailsParts.push(`Tag: ${tagText}`);

    preparedRaw.push({
      line: row.line,
      key: `${isoDate}|${slot}|${classMatch.id}`,
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
        details: detailsParts.length > 0 ? detailsParts.join("\n") : null,
      },
    });

    if (summary.minSlot == null || slot < summary.minSlot) summary.minSlot = slot;
    if (summary.maxSlot == null || slot > summary.maxSlot) summary.maxSlot = slot;
    if (!summary.minDate || isoDate < summary.minDate) summary.minDate = isoDate;
    if (!summary.maxDate || isoDate > summary.maxDate) summary.maxDate = isoDate;
  }

  const byKey = new Map<string, PreparedTimetableImportRow>();
  for (const row of preparedRaw) {
    if (byKey.has(row.key)) summary.ignoredDuplicates += 1;
    byKey.set(row.key, row);
  }

  const prepared = Array.from(byKey.values());
  summary.rowsValid = prepared.length;
  summary.rowsReady = prepared.length;

  if (prepared.length === 0) return summary;

  const baseIsoForWeek = summary.minDate ?? prepared[0].date;
  const replaceWeekStart = weekStartIso && isIsoDate(weekStartIso) ? weekStartIso : startOfIsoWeekMonday(baseIsoForWeek);
  const replaceWeekEnd = addDaysIso(replaceWeekStart, 6);
  summary.replaceWeekStart = replaceWeekStart;
  summary.replaceWeekEnd = replaceWeekEnd;

  const existingCountQuery = await ctx.supabase
    .from(T.AGENDA_ITEMS)
    .select("id", { count: "exact", head: true })
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("type", "lesson")
    .gte("date", replaceWeekStart)
    .lte("date", replaceWeekEnd);
  if (existingCountQuery.error) throw existingCountQuery.error;
  summary.deletedPrevious = existingCountQuery.count ?? 0;

  const deleted = await ctx.supabase
    .from(T.AGENDA_ITEMS)
    .delete()
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("type", "lesson")
    .gte("date", replaceWeekStart)
    .lte("date", replaceWeekEnd);
  if (deleted.error) throw deleted.error;

  for (const chunk of chunkArray(prepared, 200)) {
    const bulk = await ctx.supabase
      .from(T.AGENDA_ITEMS)
      .insert(chunk.map((row) => row.payload));

    if (!bulk.error) {
      for (const row of chunk) {
        void row;
        summary.inserted += 1;
        summary.created += 1;
      }
      continue;
    }

    for (const row of chunk) {
      const one = await ctx.supabase
        .from(T.AGENDA_ITEMS)
        .insert(row.payload);

      if (one.error) {
        summary.errors.push({ line: row.line, message: errorMessage(one.error) });
      } else {
        summary.inserted += 1;
        summary.created += 1;
      }
    }
  }

  return summary;
}

export async function listLessonScheduleWeek(params: {
  ctx: TeacherContext;
  dateFrom: string;
  dateTo: string;
}): Promise<LessonScheduleRow[]> {
  const { ctx, dateFrom, dateTo } = params;

  const { data, error } = await ctx.supabase
    .from(T.AGENDA_ITEMS)
    .select("id,date,slot,class_group_id,title,details,class_groups(id,name,grade_level)")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("teacher_id", ctx.teacherId)
    .eq("type", "lesson")
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true })
    .order("slot", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    ...(row as LessonScheduleRow),
    slot: parseSlotValue((row as any).slot) ?? 1,
    class_groups: normalizeClassGroup((row as any).class_groups),
  }));
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
  if (error) throw error;

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

  if (error) throw error;
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

  if (error) throw error;
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
  weekStartIso?: string;
}): Promise<ScheduleImportSummary> {
  return importTeacherTimetableCsv({
    ctx: params.ctx,
    rows: params.rows,
    classes: params.classes,
    weekStartIso: params.weekStartIso,
  });
}

export const listTeacherTimetableWeek = listTimetableWeek;
export const upsertTeacherTimetableSlot = upsertTimetableSlot;

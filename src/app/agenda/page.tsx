"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { formatDateFR } from "@/lib/date";

import {
  type UUID,
  type SlotNumber,
  type TeacherContext,
  type ClassGroup,
  type LessonNote,
  type LessonScheduleRow,
  type AgendaStudent,
  type AgendaQuickRemark,
  type AttendancePeriodSummaryRow,
  type ParsedScheduleCsvRow,
  type ScheduleImportSummary,
  SLOTS,
  parseSlotValue,
  normalizeSlotLabel,
  getTeacherContext,
  listClassGroups,
  listLessonScheduleWeek,
  listLessonNotesWeek,
  getLessonNote,
  upsertLessonNote,
  listStudentsForClass,
  listQuickRemarquesForStudent,
  createQuickRemarque,
  listAttendanceForClassDate,
  upsertAttendanceForClassDate,
  listAttendanceSummaryForClassPeriod,
  parseScheduleCsv,
  importTeacherScheduleCsv,
} from "./agenda";

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeekMonday(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDateShortFR(iso: string): string {
  const full = formatDateFR(iso);
  const [dd, mm] = full.split("/");
  return dd && mm ? `${dd}/${mm}` : full;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const dt = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.toISOString().slice(0, 10) === value;
}

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    if ("message" in e && typeof e.message === "string") return e.message;
    if ("error_description" in e && typeof e.error_description === "string") return e.error_description;
  }
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}

function hashString(v: string): number {
  let h = 0;
  for (let i = 0; i < v.length; i += 1) h = (h * 31 + v.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function classCellStyle(classId: UUID | null): React.CSSProperties {
  if (!classId) {
    return {
      background: "rgba(156,163,175,0.10)",
      border: "1px solid rgba(156,163,175,0.25)",
    };
  }

  const h = hashString(classId) % 360;
  return {
    background: `hsl(${h} 88% 90%)`,
    border: `1px solid hsl(${h} 62% 64%)`,
  };
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven"] as const;

const card: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "white",
  border: "1px solid rgba(0,0,0,0.10)",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
};

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "rgba(37,99,235,0.10)",
  borderColor: "rgba(37,99,235,0.25)",
};

const btnArrow: React.CSSProperties = {
  ...btn,
  padding: "4px 10px",
  minWidth: 34,
  borderRadius: 999,
  fontSize: 14,
  lineHeight: 1,
};

type ModalState = {
  open: boolean;
  date: string;
  slot: SlotNumber;
  classGroupId: UUID | null;
  className: string;
};

export default function AgendaPage() {
  const router = useRouter();

  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const classNameById = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [slotsRows, setSlotsRows] = useState<LessonScheduleRow[]>([]);
  const [noteRows, setNoteRows] = useState<LessonNote[]>([]);

  const [importRows, setImportRows] = useState<ParsedScheduleCsvRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importSummary, setImportSummary] = useState<ScheduleImportSummary | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [quickNote, setQuickNote] = useState("");

  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalInfo, setModalInfo] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDetails, setLessonDetails] = useState("");
  const [modalStudents, setModalStudents] = useState<AgendaStudent[]>([]);
  const [remarkStudentId, setRemarkStudentId] = useState<UUID | "">("");
  const [remarkText, setRemarkText] = useState("");
  const [remarkRows, setRemarkRows] = useState<AgendaQuickRemark[]>([]);
  const [remarkLoading, setRemarkLoading] = useState(false);
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [remarkInfo, setRemarkInfo] = useState<string | null>(null);
  const [attendanceByStudent, setAttendanceByStudent] = useState<Record<UUID, boolean>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceInfo, setAttendanceInfo] = useState<string | null>(null);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [attendanceReport, setAttendanceReport] = useState<AttendancePeriodSummaryRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const fullWeekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => toISODate(addDays(weekStart, i))),
    [weekStart]
  );
  const weekDays = useMemo(() => fullWeekDays.slice(0, 5), [fullWeekDays]);
  const weekLabel = useMemo(
    () => `${formatDateFR(weekDays[0])} au ${formatDateFR(weekDays[4])}`,
    [weekDays]
  );

  const previewRows = useMemo(() => importRows.slice(0, 10), [importRows]);

  const slotByDateAndPeriod = useMemo(() => {
    const map = new Map<string, LessonScheduleRow>();
    for (const row of slotsRows) {
      const slot = parseSlotValue(row.slot);
      if (!slot) continue;
      const key = `${row.date}|${slot}`;
      if (!map.has(key)) map.set(key, row);
    }
    return map;
  }, [slotsRows]);

  const noteByDateAndPeriod = useMemo(() => {
    const map = new Map<string, LessonNote>();
    for (const row of noteRows) {
      const slot = parseSlotValue(row.slot);
      if (!slot) continue;
      map.set(`${row.date}|${slot}`, row);
    }
    return map;
  }, [noteRows]);

  const ideaTags = useMemo(() => {
    const tags = new Set<string>();
    const addTagsFromText = (value: string | null | undefined) => {
      if (!value) return;
      const lower = value.toLowerCase();
      const tagPattern = /(?:^|[\s;,\[])\btag\s*:\s*([a-z0-9à-ÿ_-]+)/gi;
      const hashPattern = /#([a-z0-9à-ÿ_-]+)/gi;

      let m: RegExpExecArray | null = null;
      while ((m = tagPattern.exec(lower)) !== null) tags.add(m[1]);
      while ((m = hashPattern.exec(lower)) !== null) tags.add(m[1]);
    };

    for (const row of slotsRows) {
      addTagsFromText(row.title);
      addTagsFromText(row.details);
    }
    for (const row of noteRows) {
      addTagsFromText(row.lesson_title);
      addTagsFromText(row.plan);
      addTagsFromText(row.comments);
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b, "fr"));
  }, [slotsRows, noteRows]);

  async function boot() {
    try {
      setErrorMsg(null);
      const c = await getTeacherContext();
      setCtx(c);

      const classRows = await listClassGroups(c);
      setClasses(classRows);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function loadGrid(c: TeacherContext, fromIso: string, toIso: string) {
    try {
      setErrorMsg(null);
      const [rows, notes] = await Promise.all([
        listLessonScheduleWeek({
          ctx: c,
          dateFrom: fromIso,
          dateTo: toIso,
        }),
        listLessonNotesWeek({
          ctx: c,
          dateFrom: fromIso,
          dateTo: toIso,
        }),
      ]);
      setSlotsRows(rows);
      setNoteRows(notes);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function loadQuickRemarques(c: TeacherContext, studentId: UUID | "") {
    if (!studentId) {
      setRemarkRows([]);
      return;
    }
    setRemarkLoading(true);
    try {
      const rows = await listQuickRemarquesForStudent({ ctx: c, studentId, limit: 5 });
      setRemarkRows(rows);
    } catch (e: unknown) {
      setModalError(toNiceError(e));
      setRemarkRows([]);
    } finally {
      setRemarkLoading(false);
    }
  }

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (!ctx) return;
    void loadGrid(ctx, fullWeekDays[0], fullWeekDays[6]);
  }, [ctx, fullWeekDays]);

  useEffect(() => {
    if (!ctx || !modal?.open) return;
    void loadQuickRemarques(ctx, remarkStudentId);
  }, [ctx, modal?.open, remarkStudentId]);

  async function onSelectCsv(file: File | null) {
    try {
      setErrorMsg(null);
      setImportSummary(null);
      setImportInfo(null);
      setImportRows([]);
      setImportFileName(file?.name ?? "");
      if (!file) return;

      const text = await file.text();
      const rows = parseScheduleCsv(text);
      setImportRows(rows);
      setImportInfo(`${rows.length} ligne(s) détectée(s).`);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function onConfirmImport() {
    if (!ctx) return;
    if (importRows.length === 0) {
      setErrorMsg("Aucune ligne CSV à importer.");
      return;
    }

    try {
      setErrorMsg(null);
      setImportSummary(null);
      setImportInfo(null);
      setImporting(true);

      const summary = await importTeacherScheduleCsv({
        ctx,
        rows: importRows,
        classes,
      });

      setImportSummary(summary);
      setImportInfo(
        `Import terminé ✅ supprimés ${summary.deletedPrevious}, insérés ${summary.inserted}, erreurs ${summary.errors.length}.`
      );

      const nextStart = summary.replaceWeekStart ?? fullWeekDays[0];
      const nextEnd = summary.replaceWeekEnd ?? fullWeekDays[6];
      setWeekStart(new Date(`${nextStart}T12:00:00`));
      await loadGrid(ctx, nextStart, nextEnd);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    } finally {
      setImporting(false);
    }
  }

  async function openCellModal(params: {
    date: string;
    slot: SlotNumber;
    classGroupId: UUID | null;
    className: string;
  }) {
    if (!ctx) return;

    setModal({
      open: true,
      date: params.date,
      slot: params.slot,
      classGroupId: params.classGroupId,
      className: params.className,
    });
    setLessonTitle("");
    setLessonDetails("");
    setModalStudents([]);
    setRemarkStudentId("");
    setRemarkText("");
    setRemarkRows([]);
    setRemarkInfo(null);
    setAttendanceByStudent({});
    setAttendanceInfo(null);
    setReportFrom(params.date);
    setReportTo(params.date);
    setAttendanceReport([]);
    setModalError(null);
    setModalInfo(null);
    setModalLoading(true);

    const [noteResult, studentsResult] = await Promise.allSettled([
      getLessonNote({ ctx, date: params.date, slot: params.slot }),
      params.classGroupId
        ? listStudentsForClass({ ctx, classGroupId: params.classGroupId })
        : Promise.resolve([] as AgendaStudent[]),
    ]);

    const errors: string[] = [];

    if (noteResult.status === "fulfilled") {
      const note = noteResult.value;
      if (note) {
        setLessonTitle(note.lesson_title ?? "");
        setLessonDetails(note.comments ?? note.plan ?? "");
        if (!params.classGroupId && note.class_group_id) {
          const fallbackClassName = classNameById.get(note.class_group_id) ?? "Classe";
          setModal((prev) =>
            prev
              ? {
                  ...prev,
                  classGroupId: note.class_group_id,
                  className: fallbackClassName,
                }
              : prev
          );
        }
      }
    } else {
      errors.push(`Leçon: ${toNiceError(noteResult.reason)}`);
    }

    if (studentsResult.status === "fulfilled") {
      const students = studentsResult.value;
      setModalStudents(students);
      setRemarkStudentId(students[0]?.id ?? "");

      if (params.classGroupId && students.length > 0) {
        try {
          const records = await listAttendanceForClassDate({
            ctx,
            classGroupId: params.classGroupId,
            date: params.date,
          });
          const absentIds = new Set(records.filter((r) => r.status === "absent").map((r) => r.student_id));
          const next: Record<UUID, boolean> = {};
          for (const student of students) {
            next[student.id] = absentIds.has(student.id);
          }
          setAttendanceByStudent(next);
        } catch (attendanceError) {
          errors.push(`Présence: ${toNiceError(attendanceError)}`);
        }
      }
    } else {
      errors.push(`Élèves: ${toNiceError(studentsResult.reason)}`);
    }

    if (errors.length > 0) {
      setModalError(errors.join(" · "));
    }

    setModalLoading(false);
  }

  async function onSaveAttendance() {
    if (!ctx || !modal?.classGroupId) return;
    try {
      setModalError(null);
      setAttendanceInfo(null);
      setAttendanceSaving(true);
      await upsertAttendanceForClassDate({
        ctx,
        classGroupId: modal.classGroupId,
        date: modal.date,
        rows: modalStudents.map((student) => ({
          studentId: student.id,
          absent: !!attendanceByStudent[student.id],
        })),
      });
      const absents = modalStudents.filter((student) => attendanceByStudent[student.id]).length;
      const presents = modalStudents.length - absents;
      setAttendanceInfo(`Présence enregistrée ✅ (${presents} présents, ${absents} absents)`);
    } catch (e: unknown) {
      setModalError(toNiceError(e));
    } finally {
      setAttendanceSaving(false);
    }
  }

  async function onGenerateAttendanceReport() {
    if (!ctx || !modal?.classGroupId) return;
    if (!isIsoDate(reportFrom) || !isIsoDate(reportTo)) {
      setModalError("Période invalide. Utilise des dates au format YYYY-MM-DD.");
      return;
    }
    if (reportFrom > reportTo) {
      setModalError("La date de début doit être antérieure ou égale à la date de fin.");
      return;
    }

    try {
      setModalError(null);
      setReportLoading(true);
      const rows = await listAttendanceSummaryForClassPeriod({
        ctx,
        classGroupId: modal.classGroupId,
        dateFrom: reportFrom,
        dateTo: reportTo,
      });
      setAttendanceReport(rows);
      setAttendanceInfo(`Liste de présence générée ✅ (${rows.length} élève(s)).`);
    } catch (e: unknown) {
      setModalError(toNiceError(e));
    } finally {
      setReportLoading(false);
    }
  }

  async function onAddQuickRemarque() {
    if (!ctx) return;
    try {
      setModalError(null);
      setRemarkInfo(null);
      if (!remarkStudentId) {
        setModalError("Sélectionne un élève.");
        return;
      }
      if (!remarkText.trim()) {
        setModalError("La remarque est vide.");
        return;
      }
      setRemarkSaving(true);
      await createQuickRemarque({
        ctx,
        studentId: remarkStudentId,
        text: remarkText,
      });
      setRemarkText("");
      await loadQuickRemarques(ctx, remarkStudentId);
      setRemarkInfo("Remarque ajoutée ✅");
    } catch (e: unknown) {
      setModalError(toNiceError(e));
    } finally {
      setRemarkSaving(false);
    }
  }

  async function onSaveLesson() {
    if (!ctx || !modal) return;
    if (!modal.classGroupId) {
      setModalError("Impossible d’enregistrer: aucune classe sur ce créneau.");
      return;
    }

    try {
      setModalError(null);
      setModalInfo(null);
      setModalSaving(true);
      await upsertLessonNote({
        ctx,
        date: modal.date,
        slot: modal.slot,
        classGroupId: modal.classGroupId,
        lessonTitle,
        plan: lessonDetails,
        comments: lessonDetails,
      });

      const refreshed = await listLessonNotesWeek({
        ctx,
        dateFrom: fullWeekDays[0],
        dateTo: fullWeekDays[6],
      });
      setNoteRows(refreshed);
      setModalInfo("Leçon enregistrée ✅");
    } catch (e: unknown) {
      setModalError(toNiceError(e));
    } finally {
      setModalSaving(false);
    }
  }

  function closeModal() {
    setModal(null);
    setModalError(null);
    setModalInfo(null);
    setModalStudents([]);
    setRemarkStudentId("");
    setRemarkText("");
    setRemarkRows([]);
    setRemarkInfo(null);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {errorMsg && (
        <div style={card}>
          <div style={{ fontWeight: 900 }}>{errorMsg}</div>
        </div>
      )}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Planning hebdomadaire · {weekLabel}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btnArrow} onClick={() => setWeekStart(addDays(weekStart, -7))} title="Semaine précédente">←</button>
            <button style={btnArrow} onClick={() => setWeekStart(addDays(weekStart, 7))} title="Semaine suivante">→</button>
            <button style={btn} onClick={() => ctx && void loadGrid(ctx, fullWeekDays[0], fullWeekDays[6])} disabled={!ctx}>Rafraîchir</button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) minmax(220px, 280px)",
            gap: 12,
            alignItems: "start",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 980, borderCollapse: "separate", borderSpacing: 6 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", width: 72, padding: 8 }}>Slot</th>
                  {weekDays.map((date, idx) => (
                    <th key={date} style={{ textAlign: "left", padding: 8, fontWeight: 900 }}>
                      {WEEKDAY_LABELS[idx]} {formatDateShortFR(date)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {SLOTS.map((slot) => (
                  <tr key={`slot-${slot}`}>
                    <td style={{ verticalAlign: "top", padding: 8, fontWeight: 900 }}>P{slot}</td>

                    {weekDays.map((date) => {
                      const row = slotByDateAndPeriod.get(`${date}|${slot}`) ?? null;
                      const note = noteByDateAndPeriod.get(`${date}|${slot}`) ?? null;

                      const classId = row?.class_group_id ?? note?.class_group_id ?? null;
                      const className = classId
                        ? (row?.class_groups && !Array.isArray(row.class_groups) ? row.class_groups.name : classNameById.get(classId) ?? "Classe")
                        : "";

                      return (
                        <td
                          key={`${date}|${slot}`}
                          style={{
                            verticalAlign: "top",
                            minHeight: 92,
                            borderRadius: 12,
                            padding: 10,
                            cursor: "pointer",
                            ...classCellStyle(classId),
                          }}
                          onClick={() => void openCellModal({ date, slot, classGroupId: classId, className })}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            void openCellModal({ date, slot, classGroupId: classId, className });
                          }}
                        >
                          <div style={{ fontWeight: 900, fontSize: 13 }}>{className || ""}</div>
                          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>{note?.lesson_title || ""}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside style={{ ...card, padding: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>Idées / Tags</div>
            {ideaTags.length === 0 ? (
              <div style={{ opacity: 0.7, marginBottom: 12 }}>Aucun tag détecté pour l’instant.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {ideaTags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(37,99,235,0.25)",
                      background: "rgba(37,99,235,0.08)",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <label style={{ fontWeight: 800, fontSize: 13 }}>Note rapide</label>
            <textarea
              style={{ ...input, minHeight: 120, marginTop: 6, resize: "vertical" }}
              placeholder="Idée, rappel, tag à utiliser..."
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
            />
            <div style={{ marginTop: 8, opacity: 0.65, fontSize: 12 }}>V1: note locale non enregistrée.</div>
          </aside>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Importer horaire PROF (CSV)</div>
        <div style={{ marginBottom: 10, opacity: 0.8 }}>
          Colonnes requises: <b>date</b> (YYYY-MM-DD), <b>slot</b>, <b>class_name</b>. slot: P1..P10 (ou 1..10 accepté).
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn} onClick={() => fileInputRef.current?.click()} disabled={!ctx}>Choisir un CSV</button>
          <button style={btnPrimary} onClick={onConfirmImport} disabled={!ctx || importRows.length === 0 || importing}>
            {importing ? "Import..." : "Confirmer import"}
          </button>
          <span style={{ opacity: 0.8 }}>{importFileName ? `Fichier: ${importFileName}` : "Aucun fichier sélectionné."}</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => void onSelectCsv(e.target.files?.[0] ?? null)}
        />

        {importInfo && <div style={{ marginTop: 8, fontWeight: 700 }}>{importInfo}</div>}

        {previewRows.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Aperçu (10 premières lignes)</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Ligne</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Date</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Slot</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Classe</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => {
                    const normalizedSlot = r.slot_label || normalizeSlotLabel(r.slot_raw);
                    const isRowValid = isIsoDate(r.date_raw) && !!normalizedSlot;
                    return (
                      <tr key={r.line} style={!isRowValid ? { background: "rgba(220,38,38,0.08)" } : undefined}>
                        <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.line}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.date_raw || "—"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{normalizedSlot || r.slot_raw || "—"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.class_name_raw || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importSummary && (
          <div style={{ marginTop: 12 }}>
            <div>
              <b>Résumé:</b> supprimés {importSummary.deletedPrevious}, insérés {importSummary.inserted}, ignorés (classe vide) {importSummary.ignoredMissingClass}, doublons fichier {importSummary.ignoredDuplicates}, erreurs {importSummary.errors.length}.
            </div>
            {importSummary.errors.length > 0 && (
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {importSummary.errors.slice(0, 20).map((err, idx) => (
                  <div key={`${err.line}-${idx}`} style={{ border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: 8, background: "rgba(220,38,38,0.04)" }}>
                    Ligne {err.line}: {err.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modal?.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.48)",
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              width: "min(960px, 96vw)",
              maxHeight: "92vh",
              overflow: "auto",
              background: "white",
              borderRadius: 16,
              padding: 16,
              border: "1px solid rgba(0,0,0,0.12)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>Cours</div>
              <button style={btn} onClick={closeModal}>Fermer</button>
            </div>

            <div style={{ marginTop: 8, marginBottom: 14, opacity: 0.85 }}>
              <b>{modal.className || "Classe non définie"}</b> · {formatDateFR(modal.date)} · P{modal.slot}
            </div>

            {modalError && (
              <div style={{ ...card, marginBottom: 10, borderColor: "rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.04)" }}>
                {modalError}
              </div>
            )}
            {modalInfo && (
              <div style={{ ...card, marginBottom: 10, borderColor: "rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.06)" }}>
                {modalInfo}
              </div>
            )}

            {modalLoading ? (
              <div style={{ opacity: 0.8 }}>Chargement…</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <label style={{ fontWeight: 700 }}>Titre de la leçon</label>
                    <input style={input} value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="Titre court" />
                  </div>

                  <div>
                    <label style={{ fontWeight: 700 }}>Détails / commentaires</label>
                    <textarea
                      style={{ ...input, minHeight: 130, resize: "vertical" }}
                      value={lessonDetails}
                      onChange={(e) => setLessonDetails(e.target.value)}
                      placeholder="Contenu de la leçon, remarques, devoirs..."
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={btnPrimary} onClick={() => void onSaveLesson()} disabled={modalSaving || !ctx}>
                    {modalSaving ? "Enregistrement..." : "Enregistrer"}
                  </button>
                  <button style={btn} onClick={closeModal}>Annuler</button>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Remarques rapides</div>

                  {!modal.classGroupId ? (
                    <div style={{ opacity: 0.8 }}>Aucune classe sur ce créneau.</div>
                  ) : modalStudents.length === 0 ? (
                    <div style={{ opacity: 0.8 }}>Aucun élève trouvé pour cette classe.</div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gap: 10 }}>
                        <div>
                          <label style={{ fontWeight: 700 }}>Élève (obligatoire)</label>
                          <select
                            style={input}
                            value={remarkStudentId}
                            onChange={(e) => {
                              setRemarkStudentId(e.target.value as UUID | "");
                              setRemarkInfo(null);
                            }}
                          >
                            <option value="">Choisir un élève</option>
                            {modalStudents.map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.last_name} {student.first_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontWeight: 700 }}>Remarque</label>
                          <textarea
                            style={{ ...input, minHeight: 90, resize: "vertical" }}
                            value={remarkText}
                            onChange={(e) => setRemarkText(e.target.value)}
                            placeholder="Ajouter une remarque rapide..."
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          style={btnPrimary}
                          onClick={() => void onAddQuickRemarque()}
                          disabled={!remarkStudentId || !remarkText.trim() || remarkSaving}
                        >
                          {remarkSaving ? "Ajout..." : "Ajouter"}
                        </button>
                        <button
                          style={btn}
                          onClick={() => remarkStudentId && router.push(`/eleves/${remarkStudentId}`)}
                          disabled={!remarkStudentId}
                        >
                          Voir fiche élève
                        </button>
                        {remarkInfo && <div style={{ fontWeight: 700 }}>{remarkInfo}</div>}
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontWeight: 800, marginBottom: 6 }}>5 dernières remarques</div>
                        {remarkLoading ? (
                          <div style={{ opacity: 0.8 }}>Chargement…</div>
                        ) : remarkRows.length === 0 ? (
                          <div style={{ opacity: 0.8 }}>
                            {remarkStudentId ? "Aucune remarque pour cet élève." : "Choisis un élève."}
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 6 }}>
                            {remarkRows.map((row) => (
                              <div
                                key={row.id}
                                style={{
                                  border: "1px solid rgba(0,0,0,0.08)",
                                  borderRadius: 10,
                                  padding: "8px 10px",
                                  background: "rgba(0,0,0,0.02)",
                                }}
                              >
                                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>{formatDateFR(row.created_at)}</div>
                                <div>{row.text}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Présence journalière</div>
                  {!modal.classGroupId ? (
                    <div style={{ opacity: 0.8 }}>Aucune classe sur ce créneau.</div>
                  ) : modalStudents.length === 0 ? (
                    <div style={{ opacity: 0.8 }}>Aucun élève trouvé.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Élève</th>
                            <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Absent</th>
                            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Fiche</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalStudents.map((student) => (
                            <tr key={student.id}>
                              <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 700 }}>
                                {student.last_name} {student.first_name}
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={!!attendanceByStudent[student.id]}
                                  onChange={(e) =>
                                    setAttendanceByStudent((prev) => ({
                                      ...prev,
                                      [student.id]: e.target.checked,
                                    }))
                                  }
                                />
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)", textAlign: "right" }}>
                                <button
                                  style={{ ...btn, padding: "6px 10px" }}
                                  onClick={() => router.push(`/eleves/${student.id}`)}
                                >
                                  Ouvrir
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {modal.classGroupId && modalStudents.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button style={btnPrimary} onClick={() => void onSaveAttendance()} disabled={attendanceSaving}>
                        {attendanceSaving ? "Enregistrement..." : "Enregistrer la présence du jour"}
                      </button>
                      {attendanceInfo && <div style={{ fontWeight: 700 }}>{attendanceInfo}</div>}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Liste de présence par période</div>
                  {!modal.classGroupId ? (
                    <div style={{ opacity: 0.8 }}>Aucune classe sur ce créneau.</div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                        <div>
                          <label style={{ fontWeight: 700, fontSize: 13 }}>Du</label>
                          <input type="date" style={input} value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontWeight: 700, fontSize: 13 }}>Au</label>
                          <input type="date" style={input} value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
                        </div>
                        <button style={btn} onClick={() => void onGenerateAttendanceReport()} disabled={reportLoading}>
                          {reportLoading ? "Génération..." : "Générer"}
                        </button>
                      </div>

                      {attendanceReport.length > 0 && (
                        <div style={{ marginTop: 10, overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Élève</th>
                                <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Présent</th>
                                <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Absent</th>
                                <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Total</th>
                                <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Taux présence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendanceReport.map((row) => {
                                const rate =
                                  row.total_marked > 0 ? Math.round((row.present_count / row.total_marked) * 100) : 0;
                                return (
                                  <tr key={row.student_id}>
                                    <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 700 }}>
                                      {row.last_name} {row.first_name}
                                    </td>
                                    <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
                                      {row.present_count}
                                    </td>
                                    <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
                                      {row.absent_count}
                                    </td>
                                    <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
                                      {row.total_marked}
                                    </td>
                                    <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
                                      {rate}%
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

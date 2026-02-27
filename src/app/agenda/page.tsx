"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatDateFR } from "@/lib/date";

import {
  type UUID,
  type SlotNumber,
  type TeacherContext,
  type ClassGroup,
  type AgendaItem,
  type AgendaAssessment,
  type ParsedScheduleCsvRow,
  type ScheduleImportSummary,
  SLOTS,
  parseSlotRaw,
  parseSlotValue,
  getTeacherContext,
  listClassGroups,
  listAgendaItems,
  listAssessmentsForAgenda,
  parseScheduleCsv,
  importTeacherScheduleCsv,
  upsertAgendaLesson,
  updateAgendaLessonDetails,
  updateAgendaEvent,
  deleteAgendaItem,
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

function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    if ("message" in e && typeof e.message === "string" && e.message) return e.message;
    if ("error_description" in e && typeof e.error_description === "string" && e.error_description) {
      return e.error_description;
    }
  }
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}

function getWeekdayFromISO(isoDate: string): number {
  const dt = new Date(`${isoDate}T12:00:00`);
  return dt.getDay(); // 1..5 pour lun->ven
}

function clampSlot(n: number): SlotNumber {
  if (n <= 1) return 1;
  if (n >= 10) return 10;
  return n as SlotNumber;
}

type BadgeTone = "red" | "orange" | "violet" | "gray";

type AgendaBadge = {
  kind: "assessment" | "homework" | "test";
  id: UUID;
  title: string;
  date: string;
  slot: SlotNumber | null;
  class_group_id: UUID | null;
  details?: string | null;
  status?: "draft" | "published" | "archived";
};

type UnplacedBadge = {
  id: string;
  date: string;
  text: string;
  reason: string;
  href: string;
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven"] as const;

const card: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "white",
  border: "1px solid rgba(0,0,0,0.10)",
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  width: "100%",
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

const btnSmall: React.CSSProperties = {
  ...btn,
  padding: "6px 10px",
  fontSize: 13,
};

const btnSmallPrimary: React.CSSProperties = {
  ...btnPrimary,
  padding: "6px 10px",
  fontSize: 13,
};

function badgeStyle(tone: BadgeTone): React.CSSProperties {
  if (tone === "red") {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "rgba(220,38,38,0.12)",
      border: "1px solid rgba(220,38,38,0.35)",
      color: "#991b1b",
      borderRadius: 999,
      padding: "4px 8px",
      fontSize: 12,
      fontWeight: 800,
      textDecoration: "none",
    };
  }
  if (tone === "orange") {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "rgba(249,115,22,0.12)",
      border: "1px solid rgba(249,115,22,0.35)",
      color: "#9a3412",
      borderRadius: 999,
      padding: "4px 8px",
      fontSize: 12,
      fontWeight: 800,
      textDecoration: "none",
    };
  }
  if (tone === "violet") {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "rgba(124,58,237,0.12)",
      border: "1px solid rgba(124,58,237,0.35)",
      color: "#5b21b6",
      borderRadius: 999,
      padding: "4px 8px",
      fontSize: 12,
      fontWeight: 800,
      textDecoration: "none",
    };
  }
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(107,114,128,0.15)",
    border: "1px solid rgba(107,114,128,0.35)",
    color: "#374151",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 800,
    textDecoration: "none",
  };
}

function badgeTone(kind: AgendaBadge["kind"]): BadgeTone {
  if (kind === "assessment") return "red";
  if (kind === "homework") return "orange";
  return "violet";
}

function badgeLabel(kind: AgendaBadge["kind"]): string {
  if (kind === "assessment") return "Éval";
  if (kind === "homework") return "Devoir";
  return "Interro";
}

function truncateTitle(value: string, max = 22): string {
  const v = value.trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}…`;
}

function formatSlotLabel(raw: string): string {
  const parsed = parseSlotRaw(raw);
  if (!parsed) return raw || "—";
  return `P${parsed}`;
}

function slotToLabel(slot: SlotNumber | null): string {
  return slot ? `P${slot}` : "—";
}

function pushArrayMap<T>(map: Map<string, T[]>, key: string, value: T) {
  const prev = map.get(key);
  if (prev) prev.push(value);
  else map.set(key, [value]);
}

export default function AgendaPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [filterClassId, setFilterClassId] = useState<UUID | "">("");

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));

  const [rows, setRows] = useState<AgendaItem[]>([]);
  const [assessments, setAssessments] = useState<AgendaAssessment[]>([]);

  const [lessonDrafts, setLessonDrafts] = useState<Record<UUID, string>>({});
  const [savingLessonId, setSavingLessonId] = useState<UUID | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<AgendaBadge | null>(null);
  const [badgeEditMode, setBadgeEditMode] = useState(false);
  const [badgeEditTitle, setBadgeEditTitle] = useState("");
  const [badgeEditDetails, setBadgeEditDetails] = useState("");
  const [badgeSaving, setBadgeSaving] = useState(false);

  const [csvFileName, setCsvFileName] = useState("");
  const [csvRows, setCsvRows] = useState<ParsedScheduleCsvRow[]>([]);
  const [csvSummary, setCsvSummary] = useState<ScheduleImportSummary | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [newDate, setNewDate] = useState<string>(toISODate(new Date()));
  const [newSlot, setNewSlot] = useState<SlotNumber>(1);
  const [newClassId, setNewClassId] = useState<UUID | "">("");
  const [newCourseName, setNewCourseName] = useState("");
  const [newDetails, setNewDetails] = useState("");

  const weekDays = useMemo(() => Array.from({ length: 5 }).map((_, i) => toISODate(addDays(weekStart, i))), [weekStart]);
  const weekLabel = useMemo(() => `${formatDateFR(weekDays[0])} au ${formatDateFR(weekDays[4])}`, [weekDays]);

  const classNameById = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  const lessonsByCell = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const row of rows) {
      if (row.type !== "lesson") continue;
      if (!weekDays.includes(row.date)) continue;
      const slot = parseSlotValue(row.slot);
      if (!slot) continue;
      const key = `${row.date}|${slot}`;
      pushArrayMap(map, key, row);
    }
    return map;
  }, [rows, weekDays]);

  const lessonCellsByDayClass = useMemo(() => {
    const map = new Set<string>();
    for (const row of rows) {
      if (row.type !== "lesson" || !row.class_group_id) continue;
      if (!weekDays.includes(row.date)) continue;
      map.add(`${row.date}|${row.class_group_id}`);
    }
    return map;
  }, [rows, weekDays]);

  const eventBadgesByCell = useMemo(() => {
    const map = new Map<string, AgendaBadge[]>();
    const unplaced = new Map<string, AgendaBadge[]>();
    const eventRows = rows.filter((r) => r.type === "test" || r.type === "homework");

    for (const event of eventRows) {
      if (!weekDays.includes(event.date)) continue;
      const slot = parseSlotValue(event.slot);
      const kind: AgendaBadge["kind"] = event.type === "homework" ? "homework" : "test";
      const badge: AgendaBadge = {
        kind,
        id: event.id,
        title: event.title,
        date: event.date,
        slot: slot ?? null,
        class_group_id: event.class_group_id,
        details: event.details,
      };

      if (!slot || !event.class_group_id) {
        pushArrayMap(unplaced, event.date, badge);
        continue;
      }
      if (!lessonCellsByDayClass.has(`${event.date}|${event.class_group_id}`)) {
        pushArrayMap(unplaced, event.date, badge);
        continue;
      }

      const key = `${event.date}|${slot}|${event.class_group_id}`;
      pushArrayMap(map, key, badge);
    }
    return { map, unplaced };
  }, [rows, lessonCellsByDayClass, weekDays]);

  const assessmentBadgesByDayClass = useMemo(() => {
    const map = new Map<string, AgendaBadge[]>();
    const unplaced = new Map<string, UnplacedBadge[]>();

    for (const assessment of assessments) {
      if (!weekDays.includes(assessment.date)) continue;
      const badge: AgendaBadge = {
        kind: "assessment",
        id: assessment.id,
        title: assessment.title,
        date: assessment.date,
        slot: null,
        class_group_id: assessment.class_group_id,
        status: assessment.status,
      };

      if (assessment.class_group_id && lessonCellsByDayClass.has(`${assessment.date}|${assessment.class_group_id}`)) {
        const key = `${assessment.date}|${assessment.class_group_id}`;
        pushArrayMap(map, key, badge);
      } else {
        const className = assessment.class_group_id ? classNameById.get(assessment.class_group_id) ?? "Classe inconnue" : "Classe non précisée";
        const href = assessment.class_group_id
          ? `/evaluations?date=${assessment.date}&class_group_id=${assessment.class_group_id}&assessment_id=${assessment.id}`
          : `/evaluations?assessment_id=${assessment.id}`;
        pushArrayMap(unplaced, assessment.date, {
          id: `unplaced-assessment-${assessment.id}`,
          date: assessment.date,
          text: `Éval · ${assessment.title} · ${className}`,
          reason: "Aucun slot de leçon trouvé",
          href,
        });
      }
    }

    return { map, unplaced };
  }, [assessments, classNameById, lessonCellsByDayClass, weekDays]);

  useEffect(() => {
    if (!selectedBadge) return;
    setBadgeEditMode(false);
    setBadgeEditTitle(selectedBadge.title);
    setBadgeEditDetails(selectedBadge.details ?? "");
  }, [selectedBadge]);

  const csvPreviewStats = useMemo(() => {
    const total = csvRows.length;
    const valid = csvRows.filter(
      (r) =>
        /^\d{4}-\d{2}-\d{2}$/.test(r.date.trim()) &&
        !!parseSlotRaw(r.slot_raw) &&
        r.class_ref.trim().length > 0
    ).length;
    return { total, valid, errors: total - valid };
  }, [csvRows]);
  const csvPreviewRows = useMemo(() => csvRows.slice(0, 10), [csvRows]);

  async function boot() {
    try {
      setErrorMsg(null);
      setInfoMsg(null);
      const c = await getTeacherContext();
      setCtx(c);

      const classRows = await listClassGroups(c);
      setClasses(classRows);
      if (classRows[0]?.id) setNewClassId(classRows[0].id);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function loadAgenda(c: TeacherContext, classId: UUID | "", ws: Date) {
    try {
      const from = toISODate(ws);
      const to = toISODate(addDays(ws, 4));
      const classGroupId = classId || undefined;

      const [agendaRows, assessmentRows] = await Promise.all([
        listAgendaItems({ ctx: c, dateFrom: from, dateTo: to, classGroupId }),
        listAssessmentsForAgenda({ ctx: c, dateFrom: from, dateTo: to, classGroupId }),
      ]);

      setRows(agendaRows);
      setAssessments(assessmentRows);

      setLessonDrafts((prev) => {
        const next = { ...prev };
        for (const row of agendaRows) {
          if (row.type !== "lesson") continue;
          if (next[row.id] == null) next[row.id] = row.details ?? "";
        }
        return next;
      });
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (!ctx) return;
    void loadAgenda(ctx, filterClassId, weekStart);
  }, [ctx, filterClassId, weekStart]);

  async function onAddLesson() {
    if (!ctx) return;
    if (!newClassId) return setErrorMsg("Classe obligatoire.");
    if (!newCourseName.trim()) return setErrorMsg("Cours obligatoire.");

    try {
      setErrorMsg(null);
      setInfoMsg(null);

      await upsertAgendaLesson({
        ctx,
        classGroupId: newClassId,
        date: newDate,
        slot: newSlot,
        courseName: newCourseName.trim(),
        details: newDetails.trim() || null,
      });

      setNewCourseName("");
      setNewDetails("");
      setInfoMsg("Créneau enregistré ✅");
      await loadAgenda(ctx, filterClassId, weekStart);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function onSaveLessonDetails(itemId: UUID) {
    if (!ctx) return;
    try {
      setSavingLessonId(itemId);
      await updateAgendaLessonDetails({
        ctx,
        itemId,
        details: lessonDrafts[itemId] ?? "",
      });
      setInfoMsg("Leçon du jour enregistrée ✅");
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    } finally {
      setSavingLessonId(null);
    }
  }

  async function onDeleteItem(id: UUID) {
    if (!ctx) return;
    try {
      setErrorMsg(null);
      setInfoMsg(null);
      await deleteAgendaItem({ ctx, id });
      await loadAgenda(ctx, filterClassId, weekStart);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function onSaveBadgeEdit() {
    if (!ctx || !selectedBadge) return;
    if (selectedBadge.kind === "assessment") return;
    if (!badgeEditTitle.trim()) {
      setErrorMsg("Titre obligatoire.");
      return;
    }
    try {
      setBadgeSaving(true);
      setErrorMsg(null);
      await updateAgendaEvent({
        ctx,
        itemId: selectedBadge.id,
        title: badgeEditTitle,
        details: badgeEditDetails || null,
      });
      setSelectedBadge({
        ...selectedBadge,
        title: badgeEditTitle.trim(),
        details: badgeEditDetails.trim() || null,
      });
      setBadgeEditMode(false);
      setInfoMsg("Évènement mis à jour ✅");
      await loadAgenda(ctx, filterClassId, weekStart);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    } finally {
      setBadgeSaving(false);
    }
  }

  async function onSelectCsv(file: File | null) {
    try {
      setErrorMsg(null);
      setInfoMsg(null);
      setCsvRows([]);
      setCsvSummary(null);
      setCsvFileName(file?.name ?? "");
      if (!file) return;

      const text = await file.text();
      const parsed = parseScheduleCsv(text);
      setCsvRows(parsed);
      if (parsed.length === 0) {
        setErrorMsg("0 ligne détectée. Vérifie qu'il y a des lignes après l'en-tête et que le fichier est bien en CSV.");
      } else {
        setInfoMsg(`${parsed.length} ligne(s) CSV chargée(s).`);
      }
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function onImportCsv() {
    if (!ctx) return;
    if (csvRows.length === 0) return setErrorMsg("Aucune ligne CSV à importer.");

    try {
      setErrorMsg(null);
      setInfoMsg(null);
      setCsvSummary(null);
      setCsvImporting(true);

      const summary = await importTeacherScheduleCsv({
        ctx,
        rows: csvRows,
        classes,
      });

      setCsvSummary(summary);
      console.log("[Import horaires] diagnostic", {
        minDate: summary.minDate,
        maxDate: summary.maxDate,
        rowsValid: summary.rowsReady,
        minSlot: summary.minSlot,
        maxSlot: summary.maxSlot,
      });

      const nextWeekStart = summary.minDate ? startOfWeekMonday(fromIsoDate(summary.minDate)) : weekStart;
      setWeekStart(nextWeekStart);
      await loadAgenda(ctx, filterClassId, nextWeekStart);

      setInfoMsg(
        `Import terminé ✅ Total: ${summary.rowsTotal}, insérées: ${summary.inserted}, ignorées (doublons): ${summary.ignoredDuplicates}, erreurs: ${summary.errors.length}. Diagnostics: ${summary.minDate ?? "—"} → ${summary.maxDate ?? "—"}, slots ${summary.minSlot ?? "—"}-${summary.maxSlot ?? "—"}.`
      );
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    } finally {
      setCsvImporting(false);
    }
  }

  return (
    <div>
      {errorMsg && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontWeight: 900 }}>{errorMsg}</div>
        </div>
      )}

      {infoMsg && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontWeight: 900 }}>{infoMsg}</div>
        </div>
      )}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Planning · semaine du {weekLabel}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btn} onClick={() => setWeekStart(addDays(weekStart, -7))}>← Semaine -1</button>
            <button style={btn} onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>Cette semaine</button>
            <button style={btn} onClick={() => setWeekStart(addDays(weekStart, 7))}>Semaine +1 →</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ ...input, width: 260 }} value={filterClassId} onChange={(e) => setFilterClassId(e.target.value as UUID | "") }>
            <option value="">Toutes les classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.grade_level ? ` (niveau ${c.grade_level})` : ""}
              </option>
            ))}
          </select>

          <button style={btn} onClick={() => ctx && void loadAgenda(ctx, filterClassId, weekStart)} disabled={!ctx}>
            Rafraîchir
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", width: 90, padding: 8, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Slot</th>
                {weekDays.map((date, idx) => (
                  <th key={date} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                    <div>{DAY_LABELS[idx]} {formatDateFR(date)}</div>
                    {((assessmentBadgesByDayClass.unplaced.get(date) ?? []).length > 0 ||
                      (eventBadgesByCell.unplaced.get(date) ?? []).length > 0) && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8, marginBottom: 6 }}>À placer</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {(assessmentBadgesByDayClass.unplaced.get(date) ?? []).map((u) => (
                            <Link key={u.id} href={u.href} style={badgeStyle("gray")}>
                              {u.text}
                            </Link>
                          ))}
                          {(eventBadgesByCell.unplaced.get(date) ?? []).map((badge) => {
                            const className = badge.class_group_id
                              ? classNameById.get(badge.class_group_id) ?? "Classe inconnue"
                              : "Classe non précisée";
                            return (
                              <button
                                key={`event-unplaced-${badge.id}`}
                                style={badgeStyle(badgeTone(badge.kind))}
                                onClick={() => setSelectedBadge(badge)}
                              >
                                {badgeLabel(badge.kind)} · {className} · {truncateTitle(badge.title)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot) => (
                <tr key={`slot-${slot}`}>
                  <td style={{ verticalAlign: "top", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.08)", fontWeight: 900 }}>
                    P{slot}
                  </td>
                  {weekDays.map((date) => {
                    const key = `${date}|${slot}`;
                    const lessons = lessonsByCell.get(key) ?? [];

                    return (
                      <td key={key} style={{ verticalAlign: "top", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        {lessons.length === 0 ? (
                          <div style={{ opacity: 0.55, fontSize: 13 }}>—</div>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            {lessons.map((lesson) => {
                              const className = lesson.class_group_id ? classNameById.get(lesson.class_group_id) ?? "Classe" : "Classe non précisée";
                              const draft = lessonDrafts[lesson.id] ?? lesson.details ?? "";
                              const dayClassKey = lesson.class_group_id ? `${date}|${lesson.class_group_id}` : "";
                              const daySlotClassKey = lesson.class_group_id ? `${date}|${slot}|${lesson.class_group_id}` : "";
                              const assessmentBadges = dayClassKey ? (assessmentBadgesByDayClass.map.get(dayClassKey) ?? []) : [];
                              const eventBadges = daySlotClassKey ? (eventBadgesByCell.map.get(daySlotClassKey) ?? []) : [];
                              const lessonBadges = [...assessmentBadges, ...eventBadges];
                              return (
                                <div key={lesson.id} style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 10, padding: 8 }}>
                                  <div style={{ fontWeight: 900 }}>
                                    {lesson.title.includes(" — ") ? lesson.title : `${className} — ${lesson.title}`}
                                  </div>
                                  <input
                                    style={{ ...input, marginTop: 6 }}
                                    placeholder="Leçon du jour"
                                    value={draft}
                                    onChange={(e) => setLessonDrafts((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                                  />
                                  <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                                    <button
                                      style={{ ...btn, padding: "6px 8px", fontSize: 12 }}
                                      onClick={() => void onSaveLessonDetails(lesson.id)}
                                      disabled={savingLessonId === lesson.id}
                                    >
                                      {savingLessonId === lesson.id ? "Enregistrement..." : "Enregistrer leçon"}
                                    </button>
                                    <button style={{ ...btn, padding: "6px 8px", fontSize: 12 }} onClick={() => void onDeleteItem(lesson.id)}>
                                      Supprimer
                                    </button>
                                  </div>

                                  {lessonBadges.length > 0 && (
                                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      {lessonBadges.map((badge) => {
                                        if (badge.kind === "assessment") {
                                          const params = new URLSearchParams({
                                            date: badge.date,
                                            assessment_id: badge.id,
                                          });
                                          if (badge.class_group_id) params.set("class_group_id", badge.class_group_id);
                                          return (
                                            <Link
                                              key={`assess-${badge.id}`}
                                              href={`/evaluations?${params.toString()}`}
                                              style={badgeStyle(badgeTone(badge.kind))}
                                            >
                                              {badgeLabel(badge.kind)}: {truncateTitle(badge.title)}
                                              {badge.status === "draft" && <span style={{ opacity: 0.7 }}>(Brouillon)</span>}
                                            </Link>
                                          );
                                        }
                                        return (
                                          <button
                                            key={`event-${badge.id}`}
                                            style={badgeStyle(badgeTone(badge.kind))}
                                            onClick={() => setSelectedBadge(badge)}
                                            title="Afficher le détail"
                                          >
                                            {badgeLabel(badge.kind)}: {truncateTitle(badge.title)}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={{ ...card, padding: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>Imports horaires</div>

        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => void onSelectCsv(e.target.files?.[0] ?? null)}
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <a
            href="/templates/modele_import_horaires.csv"
            target="_blank"
            rel="noopener noreferrer"
            download
            style={{ ...btnSmall, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Télécharger modèle CSV
          </a>
          <button style={btnSmall} onClick={() => csvInputRef.current?.click()} disabled={!ctx}>
            Importer horaires (CSV)
          </button>
          <button style={btnSmallPrimary} onClick={onImportCsv} disabled={!ctx || csvRows.length === 0 || csvImporting}>
            {csvImporting ? "Import..." : "Confirmer import"}
          </button>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            {csvFileName ? `Fichier: ${csvFileName}` : "Aucun fichier sélectionné"}
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 13 }}>
          Lignes: <b>{csvPreviewStats.total}</b> · Valides: <b>{csvPreviewStats.valid}</b> · Erreurs: <b>{csvPreviewStats.errors}</b>
        </div>

        {csvPreviewRows.length > 0 && (
          <div style={{ marginTop: 8, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Ligne</th>
                  <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Date</th>
                  <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Slot</th>
                  <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Classe</th>
                </tr>
              </thead>
              <tbody>
                {csvPreviewRows.map((r) => {
                  const invalid = !/^\d{4}-\d{2}-\d{2}$/.test(r.date.trim()) || !parseSlotRaw(r.slot_raw) || !r.class_ref.trim();
                  return (
                    <tr key={r.line} style={invalid ? { background: "rgba(220,38,38,0.08)" } : undefined}>
                      <td style={{ padding: 6, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.line}</td>
                      <td style={{ padding: 6, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.date ? formatDateFR(r.date) : "—"}</td>
                      <td style={{ padding: 6, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{formatSlotLabel(r.slot_raw)}</td>
                      <td style={{ padding: 6, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.class_ref || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {csvSummary && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <b>Résultat:</b> lignes {csvSummary.rowsTotal}, valides {csvSummary.rowsReady}, insérées {csvSummary.inserted}, ignorées (doublons) {csvSummary.ignoredDuplicates}, erreurs {csvSummary.errors.length}
            {csvSummary.errors.length > 0 && (
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {csvSummary.errors.slice(0, 12).map((e, idx) => (
                  <div
                    key={`${e.line}-${idx}`}
                    style={{
                      border: "1px solid rgba(220,38,38,0.35)",
                      borderRadius: 8,
                      padding: 6,
                      background: "rgba(220,38,38,0.08)",
                    }}
                  >
                    Ligne {e.line}: {e.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ height: 14 }} />

      <div style={{ ...card, padding: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>Ajouter une leçon (date + heure)</div>

        <div style={{ display: "grid", gridTemplateColumns: "170px 110px 1fr 1fr", gap: 8 }}>
          <input type="date" style={input} value={newDate} onChange={(e) => setNewDate(e.target.value)} />

          <select style={input} value={String(newSlot)} onChange={(e) => setNewSlot(clampSlot(Number(e.target.value)))}>
            {SLOTS.map((slot) => (
              <option key={slot} value={slot}>P{slot}</option>
            ))}
          </select>

          <select style={input} value={newClassId} onChange={(e) => setNewClassId(e.target.value as UUID | "") }>
            <option value="">Choisir une classe</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.grade_level ? ` (niveau ${c.grade_level})` : ""}
              </option>
            ))}
          </select>

          <input
            style={input}
            placeholder="Cours / matière (ex: Néerlandais)"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
          />

          <input
            style={{ ...input, gridColumn: "span 4" }}
            placeholder="Leçon du jour (optionnel)"
            value={newDetails}
            onChange={(e) => setNewDetails(e.target.value)}
          />
        </div>

        <div style={{ height: 8 }} />
        <button style={btnSmallPrimary} onClick={onAddLesson} disabled={!ctx}>Enregistrer la leçon</button>
      </div>

      {selectedBadge && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 60,
          }}
          onClick={() => setSelectedBadge(null)}
        >
          <div
            style={{
              ...card,
              maxWidth: 560,
              width: "100%",
              boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                {selectedBadge.kind === "homework" ? "Détail devoir" : "Détail interro"}
              </div>
              <button style={btnSmall} onClick={() => setSelectedBadge(null)}>Fermer</button>
            </div>
            <div style={{ marginTop: 10 }}>
              <div>
                <b>Date:</b> {formatDateFR(selectedBadge.date)}
              </div>
              <div>
                <b>Classe:</b>{" "}
                {selectedBadge.class_group_id
                  ? classNameById.get(selectedBadge.class_group_id) ?? "Classe inconnue"
                  : "Classe non précisée"}
              </div>
              <div>
                <b>Slot:</b> {slotToLabel(selectedBadge.slot)}
              </div>
              <div>
                <b>Type:</b> {selectedBadge.kind === "homework" ? "Devoir" : "Interro"}
              </div>
              {badgeEditMode ? (
                <>
                  <div style={{ marginTop: 8 }}>
                    <b>Titre</b>
                    <input
                      style={{ ...input, marginTop: 4 }}
                      value={badgeEditTitle}
                      onChange={(e) => setBadgeEditTitle(e.target.value)}
                      placeholder="Titre"
                    />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <b>Détails</b>
                    <textarea
                      style={{ ...input, marginTop: 4, minHeight: 80 }}
                      value={badgeEditDetails}
                      onChange={(e) => setBadgeEditDetails(e.target.value)}
                      placeholder="Détails"
                    />
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={btnSmallPrimary} onClick={() => void onSaveBadgeEdit()} disabled={badgeSaving}>
                      {badgeSaving ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    <button style={btnSmall} onClick={() => setBadgeEditMode(false)}>
                      Annuler
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <b>Titre:</b> {selectedBadge.title}
                  </div>
                  <div>
                    <b>Détails:</b> {selectedBadge.details?.trim() || "—"}
                  </div>
                </>
              )}
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {selectedBadge.kind !== "assessment" && !badgeEditMode && (
                  <button style={btnSmall} onClick={() => setBadgeEditMode(true)}>
                    Modifier
                  </button>
                )}
                {selectedBadge.kind !== "assessment" && !badgeEditMode && (
                  <button
                    style={btnSmall}
                    onClick={async () => {
                      if (!ctx) return;
                      try {
                        await deleteAgendaItem({ ctx, id: selectedBadge.id });
                        setSelectedBadge(null);
                        setInfoMsg("Évènement supprimé ✅");
                        await loadAgenda(ctx, filterClassId, weekStart);
                      } catch (e: unknown) {
                        setErrorMsg(toNiceError(e));
                      }
                    }}
                  >
                    Supprimer
                  </button>
                )}
                <Link
                  href={`/evaluations?date=${selectedBadge.date}${selectedBadge.class_group_id ? `&class_group_id=${selectedBadge.class_group_id}` : ""}`}
                  style={btnSmallPrimary}
                >
                  Ouvrir dans Évaluations
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

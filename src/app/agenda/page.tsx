"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { formatDateFR } from "@/lib/date";

import {
  type UUID,
  type TeacherContext,
  type ClassGroup,
  type LessonScheduleRow,
  type ParsedScheduleCsvRow,
  type ScheduleImportSummary,
  SLOTS,
  parseSlotValue,
  normalizeSlotLabel,
  getTeacherContext,
  listClassGroups,
  listLessonScheduleWeek,
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

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;

const card: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "white",
  border: "1px solid rgba(0,0,0,0.10)",
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

export default function AgendaPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const classNameById = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [slotsRows, setSlotsRows] = useState<LessonScheduleRow[]>([]);

  const [importRows, setImportRows] = useState<ParsedScheduleCsvRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importSummary, setImportSummary] = useState<ScheduleImportSummary | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => toISODate(addDays(weekStart, i))), [weekStart]);
  const weekLabel = useMemo(() => `${formatDateFR(weekDays[0])} au ${formatDateFR(weekDays[6])}`, [weekDays]);

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
      const rows = await listLessonScheduleWeek({
        ctx: c,
        dateFrom: fromIso,
        dateTo: toIso,
      });
      setSlotsRows(rows);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (!ctx) return;
    void loadGrid(ctx, weekDays[0], weekDays[6]);
  }, [ctx, weekDays]);

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
        weekStartIso: weekDays[0],
      });

      setImportSummary(summary);
      setImportInfo(
        `Import terminé ✅ supprimés ${summary.deletedPrevious}, insérés ${summary.inserted}, erreurs ${summary.errors.length}.`
      );

      const nextStart = summary.replaceWeekStart ?? weekDays[0];
      const nextEnd = summary.replaceWeekEnd ?? weekDays[6];
      setWeekStart(new Date(`${nextStart}T12:00:00`));
      await loadGrid(ctx, nextStart, nextEnd);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    } finally {
      setImporting(false);
    }
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
            <button style={btn} onClick={() => setWeekStart(addDays(weekStart, -7))}>← Semaine -1</button>
            <button style={btn} onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>Cette semaine</button>
            <button style={btn} onClick={() => setWeekStart(addDays(weekStart, 7))}>Semaine +1 →</button>
            <button style={btn} onClick={() => ctx && void loadGrid(ctx, weekDays[0], weekDays[6])} disabled={!ctx}>Rafraîchir</button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1280, borderCollapse: "separate", borderSpacing: 6 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", width: 72, padding: 8 }}>Slot</th>
                {weekDays.map((date, idx) => (
                  <th key={date} style={{ textAlign: "left", padding: 8, fontWeight: 900 }}>
                    {DAY_LABELS[idx]} {formatDateShortFR(date)}
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
                    const classId = row?.class_group_id ?? null;
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
                          ...classCellStyle(classId),
                        }}
                      >
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{className || ""}</div>
                        <div style={{ opacity: 0.8, marginTop: 6, fontSize: 12 }}>{row?.details || ""}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  );
}

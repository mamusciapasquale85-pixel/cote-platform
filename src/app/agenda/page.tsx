"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { formatDateFR } from "@/lib/date";

import {
  type UUID,
  type SlotNumber,
  type TeacherContext,
  type ClassGroup,
  type LessonScheduleRow,
  type AgendaStudent,
  type ParsedScheduleCsvRow,
  type ScheduleImportSummary,
  SLOTS,
  normalizeSlotLabel,
  getTeacherContext,
  listClassGroups,
  listLessonScheduleWeek,
  listStudentsForClass,
  upsertLessonScheduleCell,
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

function normalizeTag(raw: string | null | undefined): "eval" | "devoir" | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "eval" || v === "evaluation" || v === "éval") return "eval";
  if (v === "devoir") return "devoir";
  if (v.includes("[eval]")) return "eval";
  if (v.includes("[devoir]")) return "devoir";
  return null;
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
  classGroupId: UUID | "";
  hadExistingLesson: boolean;
};

export default function AgendaPage() {
  const router = useRouter();

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
  const [showModifierPanel, setShowModifierPanel] = useState(false);

  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalInfo, setModalInfo] = useState<string | null>(null);
  const [modalStudents, setModalStudents] = useState<AgendaStudent[]>([]);
  const [modalClassGroupId, setModalClassGroupId] = useState<UUID | "">("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDetails, setLessonDetails] = useState("");

  const weekDays = useMemo(
    () => Array.from({ length: 5 }).map((_, i) => toISODate(addDays(weekStart, i))),
    [weekStart]
  );

  const weekLabel = useMemo(
    () => `${formatDateFR(weekDays[0])} au ${formatDateFR(weekDays[4])}`,
    [weekDays]
  );

  const previewRows = useMemo(() => importRows.slice(0, 10), [importRows]);

  const slotByDateAndPeriod = useMemo(() => {
    const map = new Map<string, LessonScheduleRow>();
    for (const row of slotsRows) {
      const key = `${row.date}|${row.slot}`;
      if (!map.has(key)) map.set(key, row);
    }
    return map;
  }, [slotsRows]);

  const ideaTags = useMemo(() => {
    const tags = new Set<string>();
    for (const row of slotsRows) {
      const tag = normalizeTag(row.tag);
      if (tag) tags.add(tag);
      const details = (row.details ?? "").toLowerCase();
      if (details.includes("[eval]")) tags.add("eval");
      if (details.includes("[devoir]")) tags.add("devoir");
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b, "fr"));
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

  async function loadStudents(classGroupId: UUID | "") {
    if (!ctx || !classGroupId) {
      setModalStudents([]);
      return;
    }
    const rows = await listStudentsForClass({ ctx, classGroupId });
    setModalStudents(rows);
  }

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (!ctx) return;
    void loadGrid(ctx, weekDays[0], weekDays[4]);
  }, [ctx, weekDays]);

  useEffect(() => {
    if (!modal?.open) return;
    void loadStudents(modalClassGroupId).catch((e: unknown) => setModalError(toNiceError(e)));
  }, [modal?.open, modalClassGroupId, ctx]);

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
        `Import terminé ✅ créés ${summary.created}, mis à jour ${summary.updated}, supprimés ${summary.deleted}, ignorés ${summary.ignored}, erreurs ${summary.errors.length}.`
      );

      if (summary.replaceWeekStart) {
        const monday = startOfWeekMonday(new Date(`${summary.replaceWeekStart}T12:00:00`));
        const mondayIso = toISODate(monday);
        const fridayIso = toISODate(addDays(monday, 4));
        setWeekStart(monday);
        await loadGrid(ctx, mondayIso, fridayIso);
      } else {
        await loadGrid(ctx, weekDays[0], weekDays[4]);
      }
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
    hadExistingLesson: boolean;
    lessonTitle?: string | null;
    details?: string | null;
  }) {
    setModal({
      open: true,
      date: params.date,
      slot: params.slot,
      classGroupId: params.classGroupId ?? "",
      hadExistingLesson: params.hadExistingLesson,
    });
    setModalClassGroupId(params.classGroupId ?? "");
    setLessonTitle(params.lessonTitle ?? "");
    setLessonDetails(params.details ?? "");
    setModalStudents([]);
    setModalError(null);
    setModalInfo(null);
    setModalLoading(true);

    try {
      await loadStudents(params.classGroupId ?? "");
    } catch (e: unknown) {
      setModalError(toNiceError(e));
    } finally {
      setModalLoading(false);
    }
  }

  async function onSaveLesson() {
    if (!ctx || !modal) return;
    const cleanedTitle = lessonTitle.trim();
    const cleanedDetails = lessonDetails.trim();
    const isTrulyEmptyPayload = !cleanedTitle && !cleanedDetails;

    if (!modalClassGroupId) {
      if (isTrulyEmptyPayload) {
        setModalInfo("Aucune modification à enregistrer.");
        return;
      }
      setModalError("Sélectionne une classe pour enregistrer ce créneau.");
      return;
    }

    if (!modal.hadExistingLesson && isTrulyEmptyPayload) {
      setModalInfo("Aucune modification à enregistrer.");
      return;
    }

    const className = classNameById.get(modalClassGroupId) ?? "Classe";

    try {
      setModalError(null);
      setModalInfo(null);
      setModalSaving(true);

      await upsertLessonScheduleCell({
        ctx,
        date: modal.date,
        slot: modal.slot,
        classGroupId: modalClassGroupId,
        className,
        lessonTitle: cleanedTitle || null,
        details: cleanedDetails || null,
      });

      await loadGrid(ctx, weekDays[0], weekDays[4]);
      setModalInfo("Cours enregistré ✅");
    } catch (e: unknown) {
      setModalError(toNiceError(e));
    } finally {
      setModalSaving(false);
    }
  }

  function closeModal() {
    setModal(null);
    setModalStudents([]);
    setModalClassGroupId("");
    setLessonTitle("");
    setLessonDetails("");
    setModalError(null);
    setModalInfo(null);
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
            <button style={btn} onClick={() => ctx && void loadGrid(ctx, weekDays[0], weekDays[4])} disabled={!ctx}>Rafraîchir</button>
            <button style={btn} onClick={() => setShowModifierPanel((v) => !v)} disabled={!ctx}>
              {showModifierPanel ? "Fermer" : "Modifier"}
            </button>
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

                      const classId = row?.class_group_id ?? null;
                      const className = classId
                        ? (row?.class_groups && !Array.isArray(row.class_groups) ? row.class_groups.name : classNameById.get(classId) ?? "Classe")
                        : "";

                      const rowTag = normalizeTag(row?.tag);

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
                          onClick={() =>
                            void openCellModal({
                              date,
                              slot,
                              classGroupId: classId,
                              hadExistingLesson: !!row,
                              lessonTitle: row?.lesson_title ?? null,
                              details: row?.details ?? null,
                            })
                          }
                        >
                          <div style={{ fontWeight: 900, fontSize: 13 }}>{className || ""}</div>
                          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>{row?.lesson_title || ""}</div>

                          {rowTag && (
                            <button
                              style={{
                                marginTop: 8,
                                border: "none",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 800,
                                color: "white",
                                background: rowTag === "eval" ? "#dc2626" : "#f59e0b",
                                cursor: "pointer",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (rowTag === "eval" && classId) {
                                  router.push(`/evaluations?date=${date}&class_group_id=${classId}`);
                                }
                              }}
                              title={rowTag === "eval" ? "Aller vers Évaluations" : "Tag devoir"}
                            >
                              {rowTag === "eval" ? "Éval" : "Devoir"}
                            </button>
                          )}
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
            <div style={{ opacity: 0.65, fontSize: 12 }}>V1 placeholder.</div>
          </aside>
        </div>
      </div>

      {showModifierPanel && (
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Modifier l’horaire (CSV)</div>
          <div style={{ marginBottom: 10, opacity: 0.8 }}>
            En-têtes attendus: <b>date,slot,class_name,details,lesson_title,tag</b>. Slot accepté: <b>P1..P10</b> ou <b>1..10</b>.
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
                      const isRowValid = isIsoDate(r.date_raw) && !!normalizedSlot && !!r.class_name_raw.trim();
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
                <b>Résumé:</b> créés {importSummary.created}, mis à jour {importSummary.updated}, supprimés {importSummary.deleted}, ignorés {importSummary.ignored}, erreurs {importSummary.errors.length}.
              </div>
              {importSummary.errors.length > 0 && (
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {importSummary.errors.slice(0, 30).map((err, idx) => (
                    <div key={`${err.line}-${idx}`} style={{ border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: 8, background: "rgba(220,38,38,0.04)" }}>
                      Ligne {err.line}: {err.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
              width: "min(920px, 96vw)",
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
              <b>{modalClassGroupId ? classNameById.get(modalClassGroupId) ?? "Classe" : "Classe non définie"}</b> · {formatDateFR(modal.date)} · P{modal.slot}
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
                    <label style={{ fontWeight: 700 }}>Classe</label>
                    <select
                      style={input}
                      value={modalClassGroupId}
                      onChange={(e) => {
                        setModalClassGroupId(e.target.value as UUID | "");
                        setModalInfo(null);
                        setModalError(null);
                      }}
                    >
                      <option value="">Choisir une classe</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.grade_level ? ` (niveau ${c.grade_level})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

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
                      placeholder="Contenu de la leçon, remarques..."
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
                  <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Élèves de la classe</div>
                  {!modalClassGroupId ? (
                    <div style={{ opacity: 0.8 }}>Sélectionne une classe pour afficher les élèves.</div>
                  ) : modalStudents.length === 0 ? (
                    <div style={{ opacity: 0.8 }}>Aucun élève trouvé.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Élève</th>
                            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Fiche</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalStudents.map((student) => (
                            <tr key={student.id}>
                              <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 700 }}>
                                {student.last_name} {student.first_name}
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
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

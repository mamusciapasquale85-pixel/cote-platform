"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateFR } from "@/lib/date";
import {
  type UUID, type TeacherContext, type ClassGroup, type Course, type Apprentissage,
  type Assessment, type ParsedAssessmentCsvRow, type AssessmentCsvImportSummary,
  type ParsedAssessmentResultCsvRow, type AssessmentResultCsvImportSummary,
  type AssessmentType, type ContentStatus,
  getTeacherContext, listClassGroups, listCourses, listApprentissages, listAssessments,
  parseAssessmentsCsv, parseAssessmentResultsCsv, importAssessmentsCsv, importAssessmentResultsCsv,
  createAssessment, updateAssessment, deleteAssessment,
} from "./evaluations";

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}
function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toISODate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

type Tab = "toutes" | "formative" | "summative" | "archived";

const TAB_CONFIG: { id: Tab; label: string; emoji: string }[] = [
  { id: "toutes", label: "Toutes", emoji: "📋" },
  { id: "formative", label: "Formatives", emoji: "📊" },
  { id: "summative", label: "Sommatives", emoji: "🎓" },
  { id: "archived", label: "Archivées", emoji: "🗄" },
];

// ── Modal Créer ──────────────────────────────────────────────────────────────
function CreateModal({ ctx, classes, courses, apprentissages, onCreated, onClose }: {
  ctx: TeacherContext; classes: ClassGroup[]; courses: Course[]; apprentissages: Apprentissage[];
  onCreated: () => void; onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AssessmentType>("summative");
  const [date, setDate] = useState(toISODate(new Date()));
  const [maxPoints, setMaxPoints] = useState("20");
  const [status, setStatus] = useState<ContentStatus>("draft");
  const [parentVisible, setParentVisible] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [classId, setClassId] = useState<UUID | "">(classes[0]?.id ?? "");
  const [courseId, setCourseId] = useState<UUID | "">(courses[0]?.id ?? "");
  const [apprentissageId, setApprentissageId] = useState<UUID | "">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const inp: React.CSSProperties = { height: 40, padding: "0 12px", borderRadius: 9, border: "1px solid #E5E7EB", fontSize: 14, width: "100%", boxSizing: "border-box" };
  const sel: React.CSSProperties = { ...inp, cursor: "pointer", background: "#FFF" };

  async function onSubmit() {
    if (!title.trim()) return setErr("Titre obligatoire.");
    if (!classId || !courseId) return setErr("Classe et cours obligatoires.");
    setSaving(true); setErr(null);
    try {
      await createAssessment({ ctx, title: title.trim(), type, date, max_points: Number(maxPoints) || 20, weight: null, status, parent_visible: parentVisible, instructions: instructions.trim() || null, class_group_id: classId, course_id: courseId, apprentissage_id: apprentissageId || null });
      onCreated(); onClose();
    } catch (e) { setErr(toNiceError(e)); } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ width: "min(660px,96vw)", background: "#fff", borderRadius: 20, boxShadow: "0 24px 64px rgba(15,23,42,.28)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "linear-gradient(135deg,#FF3B30,#0A84FF)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 900 }}>✏️ Nouvelle évaluation</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>×</button>
        </div>
        <div style={{ padding: 22, display: "grid", gap: 12 }}>
          {err && <div style={{ padding: "9px 14px", borderRadius: 9, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)", color: "#991B1B", fontSize: 13 }}>{err}</div>}

          {/* Type pills */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 7, textTransform: "uppercase", letterSpacing: ".05em" }}>Type</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["summative", "formative", "diag", "oral"] as const).map(t => (
                <button key={t} onClick={() => setType(t as AssessmentType)}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    border: type === t ? "2px solid #0A84FF" : "1.5px solid #E5E7EB",
                    background: type === t ? "#EFF6FF" : "#FFF", color: type === t ? "#0A63BF" : "#374151" }}>
                  {t === "summative" ? "🎓 Sommative" : t === "formative" ? "📊 Formative" : t === "diag" ? "🔍 Diag." : "🎤 Orale"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Titre *</div>
            <input style={{ ...inp, height: 44 }} placeholder="Ex: Évaluation vocabulaire — De familie" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Classe *</div>
              <select style={sel} value={classId} onChange={e => setClassId(e.target.value as UUID)}>
                <option value="">Choisir…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Cours *</div>
              <select style={sel} value={courseId} onChange={e => setCourseId(e.target.value as UUID)}>
                <option value="">Choisir…</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Date</div>
              <input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Points max</div>
              <input style={inp} value={maxPoints} onChange={e => setMaxPoints(e.target.value)} inputMode="numeric" placeholder="20" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Statut</div>
              <select style={sel} value={status} onChange={e => setStatus(e.target.value as ContentStatus)}>
                <option value="draft">Brouillon</option>
                <option value="published">Publiée</option>
                <option value="archived">Archivée</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Apprentissage</div>
              <select style={sel} value={apprentissageId} onChange={e => setApprentissageId(e.target.value as UUID | "")}>
                <option value="">Aucun</option>
                {apprentissages.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                <input type="checkbox" checked={parentVisible} onChange={e => setParentVisible(e.target.checked)} style={{ width: 15, height: 15 }} />
                Visible parents
              </label>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Instructions (optionnel)</div>
            <textarea style={{ ...inp, height: 68, resize: "vertical", paddingTop: 9 }} placeholder="Consignes, matériel requis…" value={instructions} onChange={e => setInstructions(e.target.value)} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
            <button onClick={onClose} style={{ height: 38, padding: "0 14px", borderRadius: 9, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Annuler</button>
            <button onClick={onSubmit} disabled={saving}
              style={{ height: 42, padding: "0 20px", borderRadius: 9, border: "none", background: saving ? "#9CA3AF" : "linear-gradient(135deg,#FF3B30,#0A84FF)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Enregistrement…" : "✓ Créer l'évaluation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card évaluation ──────────────────────────────────────────────────────────
function AssessmentCard({ a, apprentissageNameById, highlighted, onToggleStatus, onArchive, onDelete }: {
  a: Assessment; apprentissageNameById: Map<string, string>; highlighted: boolean;
  onToggleStatus: (a: Assessment) => void; onArchive: (a: Assessment) => void; onDelete: (id: UUID) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isFormative = a.type === "formative";
  const isPublished = a.status === "published";
  const isArchived = a.status === "archived";

  const typeColor = isFormative
    ? { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" }
    : { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" };

  return (
    <div id={`card-${a.id}`} style={{
      background: "#FFF", borderRadius: 14,
      border: highlighted ? "2px solid #0A84FF" : "1px solid #E5E7EB",
      boxShadow: highlighted ? "0 0 0 4px rgba(10,132,255,.1)" : "0 1px 3px rgba(0,0,0,.05)",
      padding: "16px 18px", transition: "box-shadow .3s",
      opacity: isArchived ? 0.7 : 1,
    }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>

        {/* Icône type */}
        <div style={{ width: 42, height: 42, borderRadius: 12, background: typeColor.bg, border: `1px solid ${typeColor.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          {isFormative ? "📊" : "🎓"}
        </div>

        {/* Contenu principal */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: typeColor.bg, color: typeColor.text, border: `1px solid ${typeColor.border}` }}>
              {isFormative ? "Formative" : "Sommative"}
            </span>
            {isPublished && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}>✓ Publiée</span>}
            {a.status === "draft" && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>Brouillon</span>}
            {isArchived && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB" }}>Archivée</span>}
            {a.parent_visible && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}>👪 Parents</span>}
          </div>

          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 5 }}>{a.title}</div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
            {a.date && <span>📅 {formatDateFR(a.date)}</span>}
            {a.max_points && <span>🎯 {a.max_points} pts</span>}
            {a.apprentissage_id && apprentissageNameById.get(a.apprentissage_id) && (
              <span>📖 {apprentissageNameById.get(a.apprentissage_id)}</span>
            )}
          </div>

          {a.instructions && (
            <div style={{ marginTop: 7, fontSize: 12, color: "#6B7280", background: "#F9FAFB", borderRadius: 8, padding: "5px 9px", fontStyle: "italic" }}>
              {a.instructions}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
          {!isArchived && (
            <button onClick={() => onToggleStatus(a)}
              style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: isPublished ? "#FFFBEB" : "#F0FDF4", cursor: "pointer", fontSize: 11, fontWeight: 700, color: isPublished ? "#92400E" : "#166534", whiteSpace: "nowrap" }}>
              {isPublished ? "↩ Brouillon" : "✓ Publier"}
            </button>
          )}
          {isArchived && (
            <button onClick={() => onToggleStatus(a)}
              style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#166534" }}>
              ↩ Restaurer
            </button>
          )}
          {!isArchived && (
            <button onClick={() => onArchive(a)}
              style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#6B7280" }}>
              🗄 Archiver
            </button>
          )}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#B91C1C" }}>
              🗑 Supprimer
            </button>
          ) : (
            <div style={{ display: "flex", gap: 3 }}>
              <button onClick={() => onDelete(a.id)} style={{ height: 30, padding: "0 8px", borderRadius: 8, border: "1px solid #F87171", background: "#FEF2F2", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#B91C1C" }}>Confirmer</button>
              <button onClick={() => setConfirmDelete(false)} style={{ height: 30, padding: "0 8px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 11 }}>×</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function EvaluationsPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [apprentissages, setApprentissages] = useState<Apprentissage[]>([]);
  const [rows, setRows] = useState<Assessment[]>([]);
  const [filterClassId, setFilterClassId] = useState<UUID | "">("");
  const [filterCourseId, setFilterCourseId] = useState<UUID | "">("");
  const [filterAssessmentId, setFilterAssessmentId] = useState<UUID | "">("");
  const [highlightedId, setHighlightedId] = useState<UUID | "">("");
  const [activeTab, setActiveTab] = useState<Tab>("toutes");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const csvRef = useRef<HTMLInputElement | null>(null);
  const resCsvRef = useRef<HTMLInputElement | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvRows, setCsvRows] = useState<ParsedAssessmentCsvRow[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvSummary, setCsvSummary] = useState<AssessmentCsvImportSummary | null>(null);
  const [resCsvFileName, setResCsvFileName] = useState("");
  const [resCsvRows, setResCsvRows] = useState<ParsedAssessmentResultCsvRow[]>([]);
  const [resCsvImporting, setResCsvImporting] = useState(false);
  const [resCsvSummary, setResCsvSummary] = useState<AssessmentResultCsvImportSummary | null>(null);
  const [resTargetId, setResTargetId] = useState<UUID | "">("");

  const apprentissageNameById = useMemo(() => new Map(apprentissages.map(a => [a.id, a.name])), [apprentissages]);

  const stats = useMemo(() => ({
    total: rows.length,
    formatives: rows.filter(r => r.type === "formative" && r.status !== "archived").length,
    sommatives: rows.filter(r => r.type === "summative" && r.status !== "archived").length,
    publiees: rows.filter(r => r.status === "published").length,
    archivees: rows.filter(r => r.status === "archived").length,
  }), [rows]);

  const filteredRows = useMemo(() => {
    if (activeTab === "toutes") return rows.filter(r => r.status !== "archived");
    if (activeTab === "archived") return rows.filter(r => r.status === "archived");
    return rows.filter(r => r.type === activeTab && r.status !== "archived");
  }, [rows, activeTab]);

  async function boot() {
    try {
      const c = await getTeacherContext();
      setCtx(c);
      const [cls, crs, apps] = await Promise.all([listClassGroups(c), listCourses(c), listApprentissages(c)]);
      setClasses(cls); setCourses(crs); setApprentissages(apps);
      if (cls[0]?.id) setFilterClassId(cls[0].id);
      if (crs[0]?.id) setFilterCourseId(crs[0].id);
    } catch (e) { setErrorMsg(toNiceError(e)); }
  }

  async function refresh(c: TeacherContext) {
    try {
      setErrorMsg(null);
      const list = await listAssessments({ ctx: c, classGroupId: filterClassId || null, courseId: filterCourseId || null, apprentissageId: null, date: null, assessmentId: filterAssessmentId || null });
      setRows(list);
    } catch (e) { setErrorMsg(toNiceError(e)); }
  }

  useEffect(() => { boot(); }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const qClass = p.get("class_group_id") ?? "";
    const qAssessment = p.get("assessment_id") ?? "";
    if (qAssessment) setFilterAssessmentId(qAssessment as UUID);
    if (qClass) setFilterClassId(qClass as UUID);
  }, []);

  useEffect(() => { if (ctx) refresh(ctx); }, [ctx, filterClassId, filterCourseId, filterAssessmentId]);

  useEffect(() => {
    if (!filterAssessmentId) return;
    const el = document.getElementById(`card-${filterAssessmentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(filterAssessmentId);
    const t = window.setTimeout(() => setHighlightedId(""), 2500);
    return () => window.clearTimeout(t);
  }, [rows, filterAssessmentId]);

  function flash(msg: string) { setInfoMsg(msg); setTimeout(() => setInfoMsg(null), 3000); }

  async function onToggleStatus(a: Assessment) {
    if (!ctx) return;
    try {
      const next: ContentStatus = a.status === "draft" ? "published" : "draft";
      await updateAssessment({ ctx, assessmentId: a.id, patch: { status: next } });
      await refresh(ctx); flash(`"${a.title}" → ${next === "published" ? "Publiée ✓" : "Brouillon"}`);
    } catch (e) { setErrorMsg(toNiceError(e)); }
  }
  async function onArchive(a: Assessment) {
    if (!ctx) return;
    try { await updateAssessment({ ctx, assessmentId: a.id, patch: { status: "archived" } }); await refresh(ctx); flash(`"${a.title}" archivée.`); }
    catch (e) { setErrorMsg(toNiceError(e)); }
  }
  async function onDelete(id: UUID) {
    if (!ctx) return;
    try { await deleteAssessment({ ctx, assessmentId: id }); await refresh(ctx); }
    catch (e) { setErrorMsg(toNiceError(e)); }
  }
  async function onSelectCsv(file: File | null) {
    setCsvRows([]); setCsvSummary(null); setCsvFileName(file?.name ?? "");
    if (!file) return;
    try { setCsvRows(parseAssessmentsCsv(await file.text())); } catch (e) { setErrorMsg(toNiceError(e)); }
  }
  async function onImportCsv() {
    if (!ctx || !csvRows.length) return;
    try { setCsvImporting(true); const s = await importAssessmentsCsv({ ctx, rows: csvRows, classes, courses, apprentissages }); setCsvSummary(s); await refresh(ctx); flash(`Import : ${s.created} créé(s).`); }
    catch (e) { setErrorMsg(toNiceError(e)); } finally { setCsvImporting(false); }
  }
  async function onSelectResCsv(file: File | null) {
    setResCsvRows([]); setResCsvSummary(null); setResCsvFileName(file?.name ?? "");
    if (!file) return;
    try { setResCsvRows(parseAssessmentResultsCsv(await file.text())); } catch (e) { setErrorMsg(toNiceError(e)); }
  }
  async function onImportResCsv() {
    if (!ctx || !resCsvRows.length) return;
    try { setResCsvImporting(true); const s = await importAssessmentResultsCsv({ ctx, rows: resCsvRows, classes, targetAssessmentId: resTargetId || null }); setResCsvSummary(s); flash(`Import résultats : ${s.upserted} ligne(s).`); }
    catch (e) { setErrorMsg(toNiceError(e)); } finally { setResCsvImporting(false); }
  }

  const selStyle: React.CSSProperties = { height: 38, padding: "0 11px", borderRadius: 9, border: "1px solid #E5E7EB", background: "#FFF", fontSize: 13, cursor: "pointer" };
  const btnStyle: React.CSSProperties = { height: 38, padding: "0 14px", borderRadius: 9, border: "1px solid #E5E7EB", background: "#FFF", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 16, padding: "0 4px 32px" }}>

      {/* Toasts */}
      {errorMsg && (
        <div style={{ padding: "11px 16px", borderRadius: 11, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)", color: "#991B1B", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
          {errorMsg} <button style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B", fontWeight: 900 }} onClick={() => setErrorMsg(null)}>×</button>
        </div>
      )}
      {infoMsg && (
        <div style={{ padding: "11px 16px", borderRadius: 11, background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.25)", color: "#166534", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
          {infoMsg} <button style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontWeight: 900 }} onClick={() => setInfoMsg(null)}>×</button>
        </div>
      )}

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {[
          { label: "Total", value: stats.total, color: "#111827", bg: "#F9FAFB" },
          { label: "Formatives", value: stats.formatives, color: "#1D4ED8", bg: "#EFF6FF" },
          { label: "Sommatives", value: stats.sommatives, color: "#6D28D9", bg: "#F5F3FF" },
          { label: "Publiées", value: stats.publiees, color: "#166534", bg: "#F0FDF4" },
          { label: "Archivées", value: stats.archivees, color: "#6B7280", bg: "#F3F4F6" },
        ].map(s => (
          <div key={s.label} style={{ borderRadius: 12, padding: "12px 14px", background: s.bg, border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs + Filtres ── */}
      <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB" }}>
          {TAB_CONFIG.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ flex: 1, padding: "12px 8px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab.id ? 800 : 500, color: activeTab === tab.id ? "#111827" : "#9CA3AF",
                borderBottom: activeTab === tab.id ? "2px solid #0A84FF" : "2px solid transparent", transition: "all .15s" }}>
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>

        {/* Filtres */}
        <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select style={selStyle} value={filterClassId} onChange={e => setFilterClassId(e.target.value as UUID)}>
            <option value="">Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={selStyle} value={filterCourseId} onChange={e => setFilterCourseId(e.target.value as UUID)}>
            <option value="">Tous les cours</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <button style={{ ...btnStyle, color: "#6B7280" }} onClick={() => setShowImport(v => !v)}>📥 Import CSV</button>
          <button onClick={() => setShowCreateModal(true)} disabled={!ctx}
            style={{ height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#FF3B30,#0A84FF)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: ctx ? "pointer" : "not-allowed" }}>
            + Nouvelle évaluation
          </button>
        </div>

        {/* Import CSV */}
        {showImport && (
          <div style={{ margin: "0 16px 16px", padding: 16, background: "#F9FAFB", borderRadius: 12, border: "1px solid #E5E7EB", display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📥 Import CSV — Évaluations</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>Colonnes : title, date, class_id/class_name, course_id/course_name</div>
            <input ref={csvRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => void onSelectCsv(e.target.files?.[0] ?? null)} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button style={btnStyle} onClick={() => csvRef.current?.click()}>Choisir CSV</button>
              <button style={{ ...btnStyle, background: csvRows.length ? "#F0FDF4" : undefined }} onClick={onImportCsv} disabled={!csvRows.length || csvImporting}>
                {csvImporting ? "Import…" : `Importer (${csvRows.length})`}
              </button>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>{csvFileName || "Aucun fichier"}</span>
            </div>
            {csvSummary && <div style={{ fontSize: 12, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 12px", color: "#166534" }}>Créés : {csvSummary.created} · Existants : {csvSummary.alreadyExisting} · Erreurs : {csvSummary.errors.length}</div>}

            <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 12, fontWeight: 700, fontSize: 14 }}>📥 Import CSV — Résultats élèves</div>
            <input ref={resCsvRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => void onSelectResCsv(e.target.files?.[0] ?? null)} />
            <select style={{ ...selStyle, maxWidth: 380 }} value={resTargetId} onChange={e => setResTargetId(e.target.value as UUID)}>
              <option value="">Évaluation cible (optionnelle)</option>
              {rows.map(a => <option key={a.id} value={a.id}>{a.title} — {formatDateFR(a.date)}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button style={btnStyle} onClick={() => resCsvRef.current?.click()}>Choisir CSV</button>
              <button style={{ ...btnStyle, background: resCsvRows.length ? "#F0FDF4" : undefined }} onClick={onImportResCsv} disabled={!resCsvRows.length || resCsvImporting}>
                {resCsvImporting ? "Import…" : `Importer résultats (${resCsvRows.length})`}
              </button>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>{resCsvFileName || "Aucun fichier"}</span>
            </div>
            {resCsvSummary && <div style={{ fontSize: 12, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 12px", color: "#166534" }}>Enregistrés : {resCsvSummary.upserted} · Doublons : {resCsvSummary.duplicatedInFile} · Erreurs : {resCsvSummary.errors.length}</div>}
          </div>
        )}
      </div>

      {/* ── Liste ── */}
      <div style={{ display: "grid", gap: 8 }}>
        {filteredRows.length === 0 ? (
          <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E5E7EB", padding: "40px 24px", textAlign: "center", color: "#6B7280" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {activeTab === "archived" ? "Aucune évaluation archivée" : "Aucune évaluation"}
            </div>
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.7 }}>
              {activeTab === "archived" ? "Les évaluations archivées apparaissent ici." : "Crée ta première évaluation avec le bouton ci-dessus."}
            </div>
          </div>
        ) : (
          filteredRows.map(a => (
            <AssessmentCard key={a.id} a={a} apprentissageNameById={apprentissageNameById}
              highlighted={a.id === highlightedId}
              onToggleStatus={onToggleStatus} onArchive={onArchive} onDelete={onDelete} />
          ))
        )}
      </div>

      {showCreateModal && ctx && (
        <CreateModal ctx={ctx} classes={classes} courses={courses} apprentissages={apprentissages}
          onCreated={() => ctx && refresh(ctx)} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

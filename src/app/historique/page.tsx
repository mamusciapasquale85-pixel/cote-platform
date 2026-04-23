"use client";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
const DARK = "#0f172a";
const ACCENT = "#0A84FF";

// ── Types ──────────────────────────────────────────────────────────────────────
type Exercice = {
  id: string; subject: string; type_exercice: string;
  niveau: string; theme: string; titre: string; classe: string; created_at: string;
};
type ArchivedEval = {
  id: string; title: string; type: string | null; date: string | null;
  max_points: number | null; fichier_path: string | null; fichier_nom: string | null;
  created_at: string; class_group_name: string | null;
};
type ClassGroup = { id: string; name: string; grade_level: number };
type Assessment = {
  id: string; title: string; date: string; type: "summative" | "formative";
  matiere: string | null; max_points: number | null;
  status: "draft" | "published" | "archived"; cotation_type: string; class_group_id: string | null;
};
type Resultat = { id: string; assessment_id: string; student_id: string; value: number | null; level: string | null };
type Student = { id: string; first_name: string; last_name: string };
type AssessmentStats = Assessment & {
  nb_resultats: number; moyenne: number | null; min_val: number | null; max_val: number | null; resultats: Resultat[];
};
type HistoriqueTab = "exercices" | "evaluations" | "par-classe";

// ── Helpers ────────────────────────────────────────────────────────────────────
const SUBJECT_EMOJI: Record<string, string> = {
  nl: "🇳🇱", en: "🇬🇧", francais: "📖", mathematiques: "📐",
  sciences: "🔬", histoire: "🏛️", geographie: "🗺️",
};
const SUBJECT_LABEL: Record<string, string> = {
  nl: "Néerlandais", en: "Anglais", francais: "Français",
  mathematiques: "Mathématiques", sciences: "Sciences", histoire: "Histoire", geographie: "Géographie",
};
const EVAL_TYPE_LABEL: Record<string, string> = {
  summative: "Sommative", formative: "Formative", diagnostic: "Diagnostique", oral: "Orale",
};
const EVAL_TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  summative:  { bg: "#FEF2F2", text: "#991B1B" },
  formative:  { bg: "#EFF6FF", text: "#1D4ED8" },
  diagnostic: { bg: "#FFF7ED", text: "#C2410C" },
  oral:       { bg: "#F5F3FF", text: "#6D28D9" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-BE", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function btnStyle(bg: string, color: string, border: string): React.CSSProperties {
  return {
    height: 34, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${border}`,
    background: bg, color, fontSize: 12, fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
  };
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function HistoriquePage() {
  const supabase = createClient();
  const [tab, setTab] = useState<HistoriqueTab>("exercices");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // ── Onglet exercices ──
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loadingEx, setLoadingEx] = useState(true);
  const [filterSubject, setFilterSubject] = useState("tous");
  const [filterClasse, setFilterClasse] = useState("");
  const [searchEx, setSearchEx] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [preview, setPreview] = useState<Exercice & { contenu?: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Onglet évaluations archivées ──
  const [archivedEvals, setArchivedEvals] = useState<ArchivedEval[]>([]);
  const [loadingEv, setLoadingEv] = useState(true);
  const [searchEv, setSearchEv] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // ── Onglet par classe ──
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [classAssessments, setClassAssessments] = useState<AssessmentStats[]>([]);
  const [classStudents, setClassStudents] = useState<Record<string, Student>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingClassAssessments, setLoadingClassAssessments] = useState(false);
  const [filterType, setFilterType] = useState<"tous" | "summative" | "formative">("tous");
  const [filterMatiere, setFilterMatiere] = useState<string>("tous");

  // ── Data loading : exercices ──
  useEffect(() => {
    if (!userId) return;
    async function loadExercices() {
      const { data } = await supabase
        .from("exercices")
        .select("id, subject, type_exercice, niveau, theme, titre, classe, created_at")
        .eq("teacher_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      setExercices((data ?? []) as Exercice[]);
      setLoadingEx(false);
    }
    void loadExercices();
  }, [userId]);

  // ── Data loading : évaluations archivées ──
  useEffect(() => {
    if (!userId) return;
    async function loadArchivedEvals() {
      const { data: assessments } = await supabase
        .from("assessments")
        .select("id, title, type, date, max_points, fichier_path, fichier_nom, created_at, class_group_id")
        .eq("status", "archived")
        .eq("teacher_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!assessments || assessments.length === 0) { setArchivedEvals([]); setLoadingEv(false); return; }
      const classIds = Array.from(new Set(assessments.map((a: any) => a.class_group_id).filter(Boolean)));
      let classMap: Record<string, string> = {};
      if (classIds.length > 0) {
        const { data: cls } = await supabase.from("class_groups").select("id, name").in("id", classIds);
        for (const c of (cls ?? []) as any[]) classMap[c.id] = c.name;
      }
      setArchivedEvals(assessments.map((a: any) => ({
        ...a, class_group_name: a.class_group_id ? (classMap[a.class_group_id] ?? null) : null,
      })));
      setLoadingEv(false);
    }
    void loadArchivedEvals();
  }, [userId]);

  // ── Data loading : classes (pour onglet "par classe") ──
  useEffect(() => {
    if (!userId) return;
    async function loadClasses() {
      const { data } = await supabase.from("class_groups").select("id, name, grade_level").eq("teacher_id", userId).order("name");
      const list: ClassGroup[] = data ?? [];
      setClasses(list);
      if (list.length > 0) setSelectedClassId(list[0].id);
      setLoadingClasses(false);
    }
    void loadClasses();
  }, [userId]);

  // ── Data loading : évaluations + résultats + élèves par classe ──
  useEffect(() => {
    if (!selectedClassId) return;
    async function loadClassData() {
      setLoadingClassAssessments(true);
      setExpandedId(null);
      setClassAssessments([]);

      const { data: aData } = await supabase
        .from("assessments")
        .select("id, title, date, type, matiere, max_points, status, cotation_type, class_group_id")
        .eq("class_group_id", selectedClassId)
        .order("date", { ascending: false });

      const aList: Assessment[] = (aData ?? []) as Assessment[];
      if (aList.length === 0) { setClassAssessments([]); setClassStudents({}); setLoadingClassAssessments(false); return; }

      const ids = aList.map(a => a.id);
      const [{ data: rData }, { data: sEnroll }] = await Promise.all([
        supabase.from("resultats").select("id, assessment_id, student_id, value, level").in("assessment_id", ids),
        supabase.from("student_enrollments").select("student_id").eq("class_group_id", selectedClassId).eq("status", "active"),
      ]);

      // Élèves
      const studentIds = (sEnroll ?? []).map((e: any) => e.student_id);
      if (studentIds.length > 0) {
        const { data: stData } = await supabase.from("students").select("id, first_name, last_name").in("id", studentIds).order("last_name");
        const stMap: Record<string, Student> = {};
        for (const s of (stData ?? []) as Student[]) stMap[s.id] = s;
        setClassStudents(stMap);
      }

      // Stats par évaluation
      const rMap: Record<string, Resultat[]> = {};
      for (const r of (rData ?? []) as Resultat[]) {
        if (!rMap[r.assessment_id]) rMap[r.assessment_id] = [];
        rMap[r.assessment_id].push(r);
      }
      setClassAssessments(aList.map(a => {
        const rs = rMap[a.id] ?? [];
        const vals = rs.map(r => r.value).filter((v): v is number => v !== null);
        return {
          ...a, nb_resultats: rs.length,
          moyenne: vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
          min_val: vals.length > 0 ? Math.min(...vals) : null,
          max_val: vals.length > 0 ? Math.max(...vals) : null,
          resultats: rs,
        };
      }));
      setLoadingClassAssessments(false);
    }
    void loadClassData();
  }, [selectedClassId]);

  // ── Filtres onglet "par classe" ──
  const matieres = useMemo(() => {
    const s = new Set(classAssessments.map(a => a.matiere ?? "").filter(Boolean));
    return Array.from(s).sort();
  }, [classAssessments]);

  const filteredClass = useMemo(() => classAssessments.filter(a => {
    if (filterType !== "tous" && a.type !== filterType) return false;
    if (filterMatiere !== "tous" && (a.matiere ?? "") !== filterMatiere) return false;
    return true;
  }), [classAssessments, filterType, filterMatiere]);

  const moyenneGlobale = useMemo(() => {
    const vals = filteredClass.flatMap(a => a.resultats.map(r => r.value).filter((v): v is number => v !== null));
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  }, [filteredClass]);

  // ── Actions exercices ──
  async function openPreview(exercice: Exercice) {
    setPreview(exercice as Exercice & { contenu?: string });
    setPreviewLoading(true);
    const { data } = await supabase.from("exercices").select("contenu").eq("id", exercice.id).single();
    setPreview(prev => prev ? { ...prev, contenu: (data as any)?.contenu ?? "" } : null);
    setPreviewLoading(false);
  }
  function copyLink(id: string) {
    void navigator.clipboard.writeText(`${window.location.origin}/eleve/${id}`);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  }
  async function deleteExercice(id: string) {
    if (!confirm("Supprimer cet exercice définitivement ?")) return;
    await supabase.from("exercices").delete().eq("id", id);
    setExercices(prev => prev.filter(e => e.id !== id));
  }

  // ── Actions évaluations archivées ──
  async function restoreEval(id: string) {
    setRestoringId(id);
    await supabase.from("assessments").update({ status: "draft" }).eq("id", id);
    setArchivedEvals(prev => prev.filter(e => e.id !== id));
    setRestoringId(null);
  }
  async function downloadEvalFile(eval_: ArchivedEval) {
    if (!eval_.fichier_path) return;
    const res = await fetch(`/api/evaluations/upload?path=${encodeURIComponent(eval_.fichier_path)}`);
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }
  async function deleteEval(id: string) {
    if (!confirm("Supprimer définitivement cette évaluation ? Cette action est irréversible.")) return;
    await supabase.from("assessments").delete().eq("id", id);
    setArchivedEvals(prev => prev.filter(e => e.id !== id));
  }

  // ── Filtres exercices ──
  const subjects = ["tous", ...Array.from(new Set(exercices.map(e => e.subject)))];
  const classesList = Array.from(new Set(exercices.map(e => e.classe).filter(Boolean)));
  const filteredEx = exercices.filter(e => {
    if (filterSubject !== "tous" && e.subject !== filterSubject) return false;
    if (filterClasse && e.classe !== filterClasse) return false;
    if (searchEx && !e.titre.toLowerCase().includes(searchEx.toLowerCase()) && !e.theme.toLowerCase().includes(searchEx.toLowerCase())) return false;
    return true;
  });
  const filteredEv = archivedEvals.filter(e => !searchEv || e.title.toLowerCase().includes(searchEv.toLowerCase()));
  const groupedEx = filteredEx.reduce<Record<string, Exercice[]>>((acc, e) => {
    const key = e.classe || "Sans classe";
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{
        borderRadius: 18, padding: "16px 22px", background: GRADIENT, color: "#fff",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>📚 Historique Klasbook</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
            Tous les fichiers générés — réimportez ou réimprimez à tout moment
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
            {exercices.length} exercice{exercices.length > 1 ? "s" : ""}
          </span>
          <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
            {archivedEvals.length} éval archivée{archivedEvals.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {([
          { id: "exercices" as const,   label: "✨ Exercices IA",          count: exercices.length },
          { id: "evaluations" as const, label: "📝 Évaluations archivées", count: archivedEvals.length },
          { id: "par-classe" as const,  label: "📊 Par classe",            count: null },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            border: "none", cursor: "pointer", borderRadius: 9,
            padding: "7px 16px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? DARK : "#64748b",
            background: tab === t.id ? "#fff" : "transparent",
            boxShadow: tab === t.id ? "0 1px 4px rgba(15,23,42,.10)" : "none",
          }}>
            {t.label}{t.count !== null && <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 4 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── TAB EXERCICES ── */}
      {tab === "exercices" && (
        <>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input type="text" value={searchEx} onChange={e => setSearchEx(e.target.value)} placeholder="🔍 Rechercher…"
              style={{ flex: 1, minWidth: 160, padding: "7px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13 }} />
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
              style={{ padding: "7px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff" }}>
              {subjects.map(s => <option key={s} value={s}>{s === "tous" ? "Toutes les matières" : `${SUBJECT_EMOJI[s] ?? ""} ${SUBJECT_LABEL[s] ?? s}`}</option>)}
            </select>
            {classesList.length > 0 && (
              <select value={filterClasse} onChange={e => setFilterClasse(e.target.value)}
                style={{ padding: "7px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff" }}>
                <option value="">Toutes les classes</option>
                {classesList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{filteredEx.length} résultat{filteredEx.length > 1 ? "s" : ""}</div>
          </div>
          {loadingEx ? (
            <Loader />
          ) : filteredEx.length === 0 ? (
            <Empty icon="📭" title="Aucun exercice trouvé" sub="Génère un exercice depuis le Générateur IA pour le voir ici." />
          ) : (
            Object.entries(groupedEx).map(([classe, items]) => (
              <div key={classe}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b", marginBottom: 8, paddingLeft: 4 }}>
                  👥 {classe} — {items.length} exercice{items.length > 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map(exercice => (
                    <div key={exercice.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                        {SUBJECT_EMOJI[exercice.subject] ?? "📄"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: DARK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{exercice.titre}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          {SUBJECT_LABEL[exercice.subject] ?? exercice.subject} · {exercice.niveau} · {formatDate(exercice.created_at)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => void openPreview(exercice)} style={btnStyle("#f8fafc", DARK, "#e2e8f0")}>👁️</button>
                        <button onClick={() => copyLink(exercice.id)}
                          style={btnStyle(copied === exercice.id ? "#f0fdf4" : "#f8fafc", copied === exercice.id ? "#16a34a" : ACCENT, copied === exercice.id ? "#86efac" : "#e2e8f0")}>
                          {copied === exercice.id ? "✓" : "🔗"}
                        </button>
                        <a href={`/eleve/${exercice.id}`} target="_blank" rel="noreferrer"
                          style={{ ...btnStyle("#f8fafc", ACCENT, "#e2e8f0"), textDecoration: "none" }}>↗️</a>
                        <button onClick={() => void deleteExercice(exercice.id)} style={btnStyle("#fff5f5", "#FF3B30", "#fca5a5")}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ── TAB ÉVALUATIONS ARCHIVÉES ── */}
      {tab === "evaluations" && (
        <>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input type="text" value={searchEv} onChange={e => setSearchEv(e.target.value)} placeholder="🔍 Rechercher par titre…"
              style={{ flex: 1, minWidth: 200, padding: "7px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13 }} />
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{filteredEv.length} évaluation{filteredEv.length > 1 ? "s" : ""}</div>
          </div>
          {loadingEv ? (
            <Loader />
          ) : filteredEv.length === 0 ? (
            <Empty icon="📭" title="Aucune évaluation archivée" sub="Archive une évaluation depuis l'onglet Évaluations pour la retrouver ici." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredEv.map(ev => {
                const typeStyle = EVAL_TYPE_COLOR[ev.type ?? ""] ?? { bg: "#f8fafc", text: "#334155" };
                return (
                  <div key={ev.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: typeStyle.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      {ev.type === "formative" ? "📊" : "🎓"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: DARK }}>{ev.title}</span>
                        {ev.type && (
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: typeStyle.bg, color: typeStyle.text }}>
                            {EVAL_TYPE_LABEL[ev.type] ?? ev.type}
                          </span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "#f3f4f6", color: "#6b7280" }}>Archivée</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        {ev.class_group_name && <span>👥 {ev.class_group_name} · </span>}
                        {ev.max_points && <span>🎯 {ev.max_points} pts · </span>}
                        {ev.date && <span>📅 {ev.date} · </span>}
                        <span>Archivé le {formatDate(ev.created_at)}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {ev.fichier_path && (
                        <button onClick={() => void downloadEvalFile(ev)} style={btnStyle("#f0fdf4", "#166534", "#bbf7d0")}>⬇ Réimprimer</button>
                      )}
                      <button onClick={() => void restoreEval(ev.id)} disabled={restoringId === ev.id}
                        style={btnStyle("#eff6ff", "#1d4ed8", "#bfdbfe")}>
                        {restoringId === ev.id ? "⏳…" : "↩ Réimporter"}
                      </button>
                      <button onClick={() => void deleteEval(ev.id)} style={btnStyle("#fff5f5", "#b91c1c", "#fecaca")}>🗑 Supprimer</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB PAR CLASSE ── */}
      {tab === "par-classe" && (
        <>
          {/* Sélecteur de classe */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {loadingClasses ? (
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Chargement des classes…</span>
            ) : classes.length === 0 ? (
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Aucune classe disponible.</span>
            ) : classes.map(c => (
              <button key={c.id} onClick={() => { setSelectedClassId(c.id); setFilterType("tous"); setFilterMatiere("tous"); }}
                style={{
                  padding: "7px 18px", borderRadius: 20, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                  background: selectedClassId === c.id ? GRADIENT : "#e2e8f0",
                  color: selectedClassId === c.id ? "#fff" : "#64748b",
                  transition: "all 0.15s",
                }}>
                {c.name}
              </button>
            ))}
          </div>

          {/* Stats globales */}
          {!loadingClassAssessments && classAssessments.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <StatCard label="Évaluations" value={filteredClass.length.toString()} icon="📋" />
              <StatCard label="Notes encodées" value={filteredClass.reduce((s, a) => s + a.nb_resultats, 0).toString()} icon="✏️" />
              <StatCard label="Moyenne générale" value={moyenneGlobale !== null ? moyenneGlobale.toFixed(1) : "—"} icon="📊" />
              <StatCard label="Formatives" value={classAssessments.filter(a => a.type === "formative").length.toString()} icon="🔵" />
              <StatCard label="Sommatives" value={classAssessments.filter(a => a.type === "summative").length.toString()} icon="🔴" />
            </div>
          )}

          {/* Filtres */}
          {!loadingClassAssessments && classAssessments.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>Filtrer :</span>
              {(["tous", "formative", "summative"] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)} style={{
                  padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  background: filterType === t ? ACCENT : "#e2e8f0",
                  color: filterType === t ? "#fff" : "#64748b",
                }}>
                  {t === "tous" ? "Tous types" : t === "formative" ? "Formative" : "Sommative"}
                </button>
              ))}
              {matieres.length > 0 && (
                <select value={filterMatiere} onChange={e => setFilterMatiere(e.target.value)}
                  style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600, color: "#64748b", background: "#fff", cursor: "pointer" }}>
                  <option value="tous">Toutes matières</option>
                  {matieres.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Liste évaluations par classe */}
          {loadingClassAssessments ? (
            <Loader />
          ) : filteredClass.length === 0 ? (
            <Empty icon="📭" title="Aucune évaluation trouvée" sub={'Créez une évaluation depuis l\'onglet "Créer une évaluation".'} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredClass.map(a => (
                <AssessmentCard
                  key={a.id} assessment={a} students={classStudents}
                  expanded={expandedId === a.id}
                  onToggle={() => setExpandedId(prev => prev === a.id ? null : a.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modal preview exercice ── */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setPreview(null)}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 18px", background: GRADIENT, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{preview.titre}</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>{SUBJECT_LABEL[preview.subject] ?? preview.subject} · {preview.niveau}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => copyLink(preview.id)}
                  style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.5)", background: "transparent", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {copied === preview.id ? "✓ Copié !" : "🔗 Lien élève"}
                </button>
                <button onClick={() => setPreview(null)}
                  style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ×
                </button>
              </div>
            </div>
            <div style={{ overflowY: "auto", padding: 20, fontSize: 13, lineHeight: 1.8, color: "#1e293b" }}>
              {previewLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>⏳ Chargement…</div>
              ) : preview.contenu ? (
                <pre style={{ fontFamily: "system-ui, sans-serif", whiteSpace: "pre-wrap", margin: 0 }}>{preview.contenu}</pre>
              ) : (
                <div style={{ color: "#94a3b8", textAlign: "center" }}>Contenu non disponible</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composant carte évaluation (onglet par-classe) ────────────────────────────
function AssessmentCard({ assessment, students, expanded, onToggle }: {
  assessment: AssessmentStats; students: Record<string, Student>; expanded: boolean; onToggle: () => void;
}) {
  const { title, date, type, matiere, max_points, status, moyenne, min_val, max_val, nb_resultats, resultats } = assessment;
  const typeColor = type === "formative" ? { bg: "#eff6ff", text: "#1d4ed8" } : { bg: "#fef2f2", text: "#dc2626" };
  const statusLabel = status === "published" ? "Publiée" : status === "draft" ? "Brouillon" : "Archivée";
  const statusColor = status === "published" ? "#16a34a" : status === "draft" ? "#d97706" : "#94a3b8";

  const sorted = [...resultats].sort((a, b) => {
    const sA = students[a.student_id]; const sB = students[b.student_id];
    return sA && sB ? sA.last_name.localeCompare(sB.last_name) : 0;
  });

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `2px solid ${expanded ? "#0A84FF" : "#e2e8f0"}`, overflow: "hidden", transition: "border-color 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div onClick={onToggle} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
        {/* Date */}
        <div style={{ textAlign: "center", minWidth: 48, flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: DARK, lineHeight: 1 }}>{new Date(date).getDate().toString().padStart(2, "0")}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>
            {new Date(date).toLocaleString("fr-BE", { month: "short" })} {new Date(date).getFullYear()}
          </div>
        </div>
        <div style={{ width: 2, height: 36, background: "#f1f5f9", flexShrink: 0 }} />
        {/* Infos */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: typeColor.bg, color: typeColor.text }}>
              {type === "formative" ? "Formative" : "Sommative"}
            </span>
            {matiere && <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: "#f0f9ff", color: "#0369a1" }}>{matiere}</span>}
            <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: "#f8fafc", color: statusColor, border: `1px solid ${statusColor}30` }}>{statusLabel}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        </div>
        {/* Stats */}
        <div style={{ display: "flex", gap: 18, flexShrink: 0, alignItems: "center" }}>
          <MiniStat label="Notés" value={nb_resultats.toString()} />
          {max_points && moyenne !== null
            ? <MiniStat label="Moyenne" value={`${moyenne.toFixed(1)} / ${max_points}`} highlight={moyenne / max_points >= 0.5} />
            : <MiniStat label="Moyenne" value="—" />}
          {max_points && min_val !== null && max_val !== null && <MiniStat label="Min – Max" value={`${min_val} – ${max_val}`} />}
        </div>
        <div style={{ fontSize: 18, color: "#94a3b8", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>▾</div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #f1f5f9", padding: "0 18px 14px" }}>
          {sorted.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8", padding: "12px 0" }}>Aucune note encodée.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
              <thead>
                <tr>
                  {["Élève", "Note", max_points ? `/ ${max_points}` : "", "Niveau", "% Réussite"].map((h, i) => (
                    <th key={i} style={{ textAlign: "left", padding: "5px 8px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const st = students[r.student_id];
                  const pct = r.value !== null && max_points ? (r.value / max_points) * 100 : null;
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "7px 8px", fontSize: 13, fontWeight: 600, color: DARK }}>
                        {st ? `${st.last_name} ${st.first_name}` : r.student_id.slice(0, 8)}
                      </td>
                      <td style={{ padding: "7px 8px", fontSize: 14, fontWeight: 800, color: DARK }}>{r.value ?? "—"}</td>
                      <td style={{ padding: "7px 8px", fontSize: 12, color: "#64748b" }}>{max_points ? `/ ${max_points}` : ""}</td>
                      <td style={{ padding: "7px 8px" }}>
                        {r.level ? <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#16a34a" }}>{r.level}</span> : "—"}
                      </td>
                      <td style={{ padding: "7px 8px" }}>
                        {pct !== null ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <div style={{ width: 70, height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, borderRadius: 3, background: pct >= 50 ? "#22c55e" : "#f87171" }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 50 ? "#16a34a" : "#dc2626" }}>{pct.toFixed(0)}%</span>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Micro-composants ──────────────────────────────────────────────────────────
function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "12px 18px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, minWidth: 120 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: DARK, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginTop: 2, textTransform: "uppercase" }}>{label}</div>
      </div>
    </div>
  );
}
function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: highlight === false ? "#dc2626" : highlight === true ? "#16a34a" : DARK }}>{value}</div>
      <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}
function Loader() {
  return <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 40, textAlign: "center", color: "#94a3b8" }}><div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>Chargement…</div>;
}
function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1.5px dashed #e2e8f0", padding: 40, textAlign: "center", color: "#94a3b8" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontWeight: 700, color: "#64748b", fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

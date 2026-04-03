"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

// ── Types ──────────────────────────────────────────────────────────────────────

type Exercice = {
  id: string;
  subject: string;
  type_exercice: string;
  niveau: string;
  theme: string;
  titre: string;
  classe: string;
  created_at: string;
};

type ArchivedEval = {
  id: string;
  title: string;
  type: string | null;
  date: string | null;
  max_points: number | null;
  fichier_path: string | null;
  fichier_nom: string | null;
  created_at: string;
  class_group_name: string | null;
};

type HistoriqueTab = "exercices" | "evaluations";

// ── Helpers ────────────────────────────────────────────────────────────────────

const SUBJECT_EMOJI: Record<string, string> = {
  nl: "🇳🇱", en: "🇬🇧", francais: "📖", mathematiques: "📐",
  sciences: "🔬", histoire: "🏛️", geographie: "🗺️",
};
const SUBJECT_LABEL: Record<string, string> = {
  nl: "Néerlandais", en: "Anglais", francais: "Français",
  mathematiques: "Mathématiques", sciences: "Sciences",
  histoire: "Histoire", geographie: "Géographie",
};
const EVAL_TYPE_LABEL: Record<string, string> = {
  summative: "Sommative", formative: "Formative",
  diagnostic: "Diagnostique", oral: "Orale",
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

  // Exercices (générateur IA)
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loadingEx, setLoadingEx] = useState(true);
  const [filterSubject, setFilterSubject] = useState("tous");
  const [filterClasse, setFilterClasse] = useState("");
  const [searchEx, setSearchEx] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [preview, setPreview] = useState<Exercice & { contenu?: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Évaluations archivées
  const [archivedEvals, setArchivedEvals] = useState<ArchivedEval[]>([]);
  const [loadingEv, setLoadingEv] = useState(true);
  const [searchEv, setSearchEv] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadExercices() {
      const { data } = await supabase
        .from("exercices")
        .select("id, subject, type_exercice, niveau, theme, titre, classe, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      setExercices((data ?? []) as Exercice[]);
      setLoadingEx(false);
    }
    void loadExercices();
  }, []);

  useEffect(() => {
    async function loadArchivedEvals() {
      // Fetch archived assessments (RLS filtre automatiquement par user)
      const { data: assessments } = await supabase
        .from("assessments")
        .select("id, title, type, date, max_points, fichier_path, fichier_nom, created_at, class_group_id")
        .eq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!assessments || assessments.length === 0) {
        setArchivedEvals([]);
        setLoadingEv(false);
        return;
      }

      // Fetch class names
      const classIds = Array.from(new Set(assessments.map((a: any) => a.class_group_id).filter(Boolean)));
      let classMap: Record<string, string> = {};
      if (classIds.length > 0) {
        const { data: classes } = await supabase
          .from("class_groups")
          .select("id, name")
          .in("id", classIds);
        for (const c of (classes ?? []) as any[]) classMap[c.id] = c.name;
      }

      setArchivedEvals(assessments.map((a: any) => ({
        ...a,
        class_group_name: a.class_group_id ? (classMap[a.class_group_id] ?? null) : null,
      })));
      setLoadingEv(false);
    }
    void loadArchivedEvals();
  }, []);

  // ── Actions exercices ──────────────────────────────────────────────────────

  async function openPreview(exercice: Exercice) {
    setPreview(exercice as Exercice & { contenu?: string });
    setPreviewLoading(true);
    const { data } = await supabase.from("exercices").select("contenu").eq("id", exercice.id).single();
    setPreview(prev => prev ? { ...prev, contenu: (data as any)?.contenu ?? "" } : null);
    setPreviewLoading(false);
  }

  function copyLink(id: string) {
    void navigator.clipboard.writeText(`${window.location.origin}/eleve/${id}`);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function deleteExercice(id: string) {
    if (!confirm("Supprimer cet exercice définitivement ?")) return;
    await supabase.from("exercices").delete().eq("id", id);
    setExercices(prev => prev.filter(e => e.id !== id));
  }

  // ── Actions évaluations archivées ─────────────────────────────────────────

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

  // ── Filtres exercices ──────────────────────────────────────────────────────

  const subjects = ["tous", ...Array.from(new Set(exercices.map(e => e.subject)))];
  const classes = Array.from(new Set(exercices.map(e => e.classe).filter(Boolean)));

  const filteredEx = exercices.filter(e => {
    if (filterSubject !== "tous" && e.subject !== filterSubject) return false;
    if (filterClasse && e.classe !== filterClasse) return false;
    if (searchEx && !e.titre.toLowerCase().includes(searchEx.toLowerCase()) && !e.theme.toLowerCase().includes(searchEx.toLowerCase())) return false;
    return true;
  });

  const filteredEv = archivedEvals.filter(e =>
    !searchEv || e.title.toLowerCase().includes(searchEv.toLowerCase())
  );

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
          { id: "exercices" as const, label: "✨ Exercices IA", count: exercices.length },
          { id: "evaluations" as const, label: "📝 Évaluations archivées", count: archivedEvals.length },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            border: "none", cursor: "pointer", borderRadius: 9,
            padding: "7px 16px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? "#0f172a" : "#64748b",
            background: tab === t.id ? "#fff" : "transparent",
            boxShadow: tab === t.id ? "0 1px 4px rgba(15,23,42,.10)" : "none",
          }}>
            {t.label} <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 4 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── TAB EXERCICES ── */}
      {tab === "exercices" && (
        <>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input type="text" value={searchEx} onChange={e => setSearchEx(e.target.value)}
              placeholder="🔍 Rechercher…"
              style={{ flex: 1, minWidth: 160, padding: "7px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13 }} />
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
              style={{ padding: "7px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff" }}>
              {subjects.map(s => <option key={s} value={s}>{s === "tous" ? "Toutes les matières" : `${SUBJECT_EMOJI[s] ?? ""} ${SUBJECT_LABEL[s] ?? s}`}</option>)}
            </select>
            {classes.length > 0 && (
              <select value={filterClasse} onChange={e => setFilterClasse(e.target.value)}
                style={{ padding: "7px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff" }}>
                <option value="">Toutes les classes</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{filteredEx.length} résultat{filteredEx.length > 1 ? "s" : ""}</div>
          </div>

          {loadingEx ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 40, textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>Chargement…
            </div>
          ) : filteredEx.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px dashed #e2e8f0", padding: 40, textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 700, color: "#64748b", fontSize: 14 }}>Aucun exercice trouvé</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Génère un exercice depuis le Générateur IA pour le voir ici.</div>
            </div>
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
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{exercice.titre}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          {SUBJECT_LABEL[exercice.subject] ?? exercice.subject} · {exercice.niveau} · {formatDate(exercice.created_at)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => void openPreview(exercice)} title="Prévisualiser" style={btnStyle("#f8fafc", "#0f172a", "#e2e8f0")}>👁️</button>
                        <button onClick={() => copyLink(exercice.id)} title="Copier le lien élève"
                          style={btnStyle(copied === exercice.id ? "#f0fdf4" : "#f8fafc", copied === exercice.id ? "#16a34a" : "#0A84FF", copied === exercice.id ? "#86efac" : "#e2e8f0")}>
                          {copied === exercice.id ? "✓" : "🔗"}
                        </button>
                        <a href={`/eleve/${exercice.id}`} target="_blank" rel="noreferrer" title="Ouvrir la page élève"
                          style={{ ...btnStyle("#f8fafc", "#0A84FF", "#e2e8f0"), textDecoration: "none" }}>↗️</a>
                        <button onClick={() => void deleteExercice(exercice.id)} title="Supprimer" style={btnStyle("#fff5f5", "#FF3B30", "#fca5a5")}>🗑️</button>
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
            <input type="text" value={searchEv} onChange={e => setSearchEv(e.target.value)}
              placeholder="🔍 Rechercher par titre…"
              style={{ flex: 1, minWidth: 200, padding: "7px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13 }} />
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{filteredEv.length} évaluation{filteredEv.length > 1 ? "s" : ""}</div>
          </div>

          {loadingEv ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 40, textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>Chargement…
            </div>
          ) : filteredEv.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px dashed #e2e8f0", padding: 40, textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 700, color: "#64748b", fontSize: 14 }}>Aucune évaluation archivée</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Archive une évaluation depuis l'onglet Évaluations pour la retrouver ici.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredEv.map(ev => {
                const typeStyle = EVAL_TYPE_COLOR[ev.type ?? ""] ?? { bg: "#f8fafc", text: "#334155" };
                return (
                  <div key={ev.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Icone type */}
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: typeStyle.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      {ev.type === "formative" ? "📊" : "🎓"}
                    </div>

                    {/* Infos */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{ev.title}</span>
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

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {ev.fichier_path && (
                        <button onClick={() => void downloadEvalFile(ev)} style={btnStyle("#f0fdf4", "#166534", "#bbf7d0")}>
                          ⬇ Réimprimer
                        </button>
                      )}
                      <button
                        onClick={() => void restoreEval(ev.id)}
                        disabled={restoringId === ev.id}
                        style={btnStyle("#eff6ff", "#1d4ed8", "#bfdbfe")}>
                        {restoringId === ev.id ? "⏳…" : "↩ Réimporter"}
                      </button>
                      <button onClick={() => void deleteEval(ev.id)} style={btnStyle("#fff5f5", "#b91c1c", "#fecaca")}>
                        🗑 Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
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

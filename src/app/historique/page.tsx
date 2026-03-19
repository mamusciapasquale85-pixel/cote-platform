"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

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

const SUBJECT_EMOJI: Record<string, string> = {
  nl: "🇳🇱",
  en: "🇬🇧",
  francais: "📖",
  mathematiques: "📐",
  sciences: "🔬",
  histoire: "🏛️",
  geographie: "🗺️",
};

const SUBJECT_LABEL: Record<string, string> = {
  nl: "Néerlandais",
  en: "Anglais",
  francais: "Français",
  mathematiques: "Mathématiques",
  sciences: "Sciences",
  histoire: "Histoire",
  geographie: "Géographie",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-BE", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function HistoriquePage() {
  const supabase = createClient();
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState("tous");
  const [filterClasse, setFilterClasse] = useState("");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Preview modal
  const [preview, setPreview] = useState<Exercice & { contenu?: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("exercices")
        .select("id, subject, type_exercice, niveau, theme, titre, classe, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      setExercices((data ?? []) as Exercice[]);
      setLoading(false);
    }
    void load();
  }, [supabase]);

  // Filtres
  const subjects = ["tous", ...Array.from(new Set(exercices.map(e => e.subject)))];
  const classes = Array.from(new Set(exercices.map(e => e.classe).filter(Boolean)));

  const filtered = exercices.filter(e => {
    if (filterSubject !== "tous" && e.subject !== filterSubject) return false;
    if (filterClasse && e.classe !== filterClasse) return false;
    if (search && !e.titre.toLowerCase().includes(search.toLowerCase()) && !e.theme.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Groupement par classe
  const grouped = filtered.reduce<Record<string, Exercice[]>>((acc, e) => {
    const key = e.classe || "Sans classe";
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  async function openPreview(exercice: Exercice) {
    setPreview(exercice as Exercice & { contenu?: string });
    setPreviewLoading(true);
    const { data } = await supabase
      .from("exercices")
      .select("contenu")
      .eq("id", exercice.id)
      .single();
    setPreview(prev => prev ? { ...prev, contenu: (data as { contenu?: string })?.contenu ?? "" } : null);
    setPreviewLoading(false);
  }

  function copyLink(id: string) {
    const url = `${window.location.origin}/eleve/${id}`;
    void navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function deleteExercice(id: string) {
    if (!confirm("Supprimer cet exercice définitivement ?")) return;
    await supabase.from("exercices").delete().eq("id", id);
    setExercices(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{
        borderRadius: 18, padding: "14px 20px", background: GRADIENT, color: "#fff",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>📚 Historique des exercices</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 1 }}>
            {exercices.length} exercice{exercices.length > 1 ? "s" : ""} générés · Partage par lien · Correction IA
          </div>
        </div>
        <div style={{ fontSize: 28 }}>🗂️</div>
      </div>

      {/* Filtres */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher…"
          style={{ flex: 1, minWidth: 160, padding: "7px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13 }}
        />

        <select
          value={filterSubject}
          onChange={e => setFilterSubject(e.target.value)}
          style={{ padding: "7px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff" }}
        >
          {subjects.map(s => (
            <option key={s} value={s}>
              {s === "tous" ? "Toutes les matières" : `${SUBJECT_EMOJI[s] ?? ""} ${SUBJECT_LABEL[s] ?? s}`}
            </option>
          ))}
        </select>

        {classes.length > 0 && (
          <select
            value={filterClasse}
            onChange={e => setFilterClasse(e.target.value)}
            style={{ padding: "7px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff" }}
          >
            <option value="">Toutes les classes</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 40, textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px dashed #e2e8f0", padding: 40, textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 700, color: "#64748b", fontSize: 14 }}>Aucun exercice trouvé</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            Génère un exercice depuis &quot;Créer une éval.&quot; pour le voir apparaître ici.
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([classe, items]) => (
          <div key={classe}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b", marginBottom: 8, paddingLeft: 4 }}>
              👥 {classe} — {items.length} exercice{items.length > 1 ? "s" : ""}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(exercice => (
                <div key={exercice.id} style={{
                  background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
                  padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                  transition: "box-shadow 0.15s",
                }}>
                  {/* Emoji matière */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "#f8fafc", border: "1px solid #e2e8f0",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                    flexShrink: 0,
                  }}>
                    {SUBJECT_EMOJI[exercice.subject] ?? "📄"}
                  </div>

                  {/* Infos */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {exercice.titre}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {SUBJECT_LABEL[exercice.subject] ?? exercice.subject} · {exercice.niveau} · {formatDate(exercice.created_at)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => void openPreview(exercice)}
                      title="Prévisualiser"
                      style={btnStyle("#f8fafc", "#0f172a", "#e2e8f0")}
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => copyLink(exercice.id)}
                      title="Copier le lien élève"
                      style={btnStyle(copied === exercice.id ? "#f0fdf4" : "#f8fafc", copied === exercice.id ? "#16a34a" : "#0A84FF", copied === exercice.id ? "#86efac" : "#e2e8f0")}
                    >
                      {copied === exercice.id ? "✓" : "🔗"}
                    </button>
                    <a
                      href={`/eleve/${exercice.id}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Ouvrir la page élève"
                      style={{ ...btnStyle("#f8fafc", "#0A84FF", "#e2e8f0"), textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      ↗️
                    </a>
                    <button
                      onClick={() => void deleteExercice(exercice.id)}
                      title="Supprimer"
                      style={btnStyle("#fff5f5", "#FF3B30", "#fca5a5")}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal preview */}
      {preview && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, padding: 20,
          }}
          onClick={() => setPreview(null)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 16, width: "100%", maxWidth: 720,
              maxHeight: "85vh", display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              padding: "14px 18px", background: GRADIENT, color: "#fff",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{preview.titre}</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>{SUBJECT_LABEL[preview.subject] ?? preview.subject} · {preview.niveau}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => copyLink(preview.id)}
                  style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.5)", background: "transparent", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {copied === preview.id ? "✓ Copié !" : "🔗 Lien élève"}
                </button>
                <button
                  onClick={() => setPreview(null)}
                  style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal content */}
            <div style={{ overflowY: "auto", padding: 20, fontSize: 13, lineHeight: 1.8, color: "#1e293b" }}>
              {previewLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>⏳ Chargement…</div>
              ) : preview.contenu ? (
                <pre style={{ fontFamily: "system-ui, sans-serif", whiteSpace: "pre-wrap", margin: 0 }}>
                  {preview.contenu}
                </pre>
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

function btnStyle(bg: string, color: string, border: string): React.CSSProperties {
  return {
    width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${border}`,
    background: bg, color, fontSize: 15, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
  };
}

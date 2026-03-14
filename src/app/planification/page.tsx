"use client";
import { useEffect, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
type Fichier = { name: string; url?: string; notion_page_id?: string; type: "evaluation" | "lecon" | "autre" };
type Semaine = {
  id: string; is_header: boolean; date_label: string; support: string | null;
  titres: string; objectifs: string; competences: string; numerique: string;
  fichiers: Fichier[]; notion_url?: string; source_type: string;
};
type Source = {
  id: string; name: string; academic_year: string; source_type: string;
  config: Record<string, string>; color: string;
};

// ── Constantes UI ────────────────────────────────────────────────────────────
const SUPPORT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "RIT 3": { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  "RIT 4": { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  "RIT 5": { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
};
const SOURCE_ICONS: Record<string, string> = {
  notion: "N", fichier: "📁", manuel: "✏️", google_sheets: "📊",
};
const SOURCE_LABELS: Record<string, string> = {
  notion: "Notion", fichier: "Fichier uploadé", manuel: "Saisie manuelle", google_sheets: "Google Sheets",
};
const YEAR_COLORS = ["#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

// ── Modale ajout source ───────────────────────────────────────────────────────
function ModalAjoutSource({ onClose, onAdded }: { onClose: () => void; onAdded: (s: Source) => void }) {
  const [step, setStep] = useState<"type" | "config">("type");
  const [type, setType] = useState<string>("notion");
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [notionDbId, setNotionDbId] = useState("");
  const [color, setColor] = useState(YEAR_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extraire l'ID d'une URL Notion collée
  const handleNotionUrl = (val: string) => {
    const match = val.match(/([a-f0-9]{32})/);
    if (match) setNotionDbId(match[1]);
    else setNotionDbId(val.trim());
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Donne un nom à cette planification."); return; }
    if (type === "notion" && !notionDbId.trim()) { setError("Colle l'URL ou l'ID de ta base Notion."); return; }
    setLoading(true); setError(null);
    try {
      const config = type === "notion" ? { db_id: notionDbId.trim() } : {};
      const res = await fetch("/api/planification/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, academic_year: year, source_type: type, config, color }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAdded(data.source);
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#FFF", borderRadius: 16, padding: 32, width: 480, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#111827" }}>
          ➕ Ajouter une planification
        </h2>

        {step === "type" ? (
          <>
            <p style={{ margin: "0 0 16px", color: "#6B7280", fontSize: 14 }}>Quelle est la source de cette planification ?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
              {[
                { key: "notion", label: "Base Notion", desc: "Synchronisé en temps réel" },
                { key: "fichier", label: "Fichier / PDF", desc: "Upload un document" },
                { key: "manuel", label: "Saisie manuelle", desc: "Crée semaine par semaine" },
                { key: "google_sheets", label: "Google Sheets", desc: "Bientôt disponible", disabled: true },
              ].map(opt => (
                <button key={opt.key} disabled={opt.disabled}
                  onClick={() => setType(opt.key)}
                  style={{
                    padding: "14px 16px", borderRadius: 10, textAlign: "left", cursor: opt.disabled ? "not-allowed" : "pointer",
                    border: type === opt.key ? "2px solid #6366F1" : "2px solid #E5E7EB",
                    background: type === opt.key ? "#EEF2FF" : opt.disabled ? "#F9FAFB" : "#FFF",
                    opacity: opt.disabled ? 0.5 : 1,
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{SOURCE_ICONS[opt.key]} {opt.label}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F3F4F6", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={() => setStep("config")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#111827", color: "#FFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Suivant →</button>
            </div>
          </>
        ) : (
          <>
            {/* Nom */}
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>Nom</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Planification 2026-2027"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }} />

            {/* Année scolaire */}
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>Année scolaire</label>
            <input value={year} onChange={e => setYear(e.target.value)} placeholder="ex: 2026-2027"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }} />

            {/* Config spécifique */}
            {type === "notion" && (
              <>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>URL ou ID de la base Notion</label>
                <input onChange={e => handleNotionUrl(e.target.value)} placeholder="https://www.notion.so/... ou 2ec1749d..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, marginBottom: 4, boxSizing: "border-box" }} />
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9CA3AF" }}>
                  💡 Colle l'URL de ta base Notion — l'ID est extrait automatiquement. N'oublie pas de partager la base avec l'intégration Klasbook.
                </p>
              </>
            )}
            {type === "fichier" && (
              <p style={{ padding: 12, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, fontSize: 13, color: "#C2410C", marginBottom: 14 }}>
                📁 Après avoir créé la source, tu pourras uploader tes PDF et les lier à chaque semaine depuis la page planification.
              </p>
            )}
            {type === "manuel" && (
              <p style={{ padding: 12, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, fontSize: 13, color: "#15803D", marginBottom: 14 }}>
                ✏️ Tu saisiras les semaines une par une directement dans Klasbook.
              </p>
            )}

            {/* Couleur */}
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>Couleur</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {YEAR_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? "3px solid #111827" : "3px solid transparent", cursor: "pointer" }} />
              ))}
            </div>

            {error && <p style={{ color: "#B91C1C", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setStep("type")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F3F4F6", fontSize: 13, cursor: "pointer" }}>← Retour</button>
              <button onClick={handleSubmit} disabled={loading}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: loading ? "#9CA3AF" : "#111827", color: "#FFF", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Création…" : "Créer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function PlanificationPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [semaines, setSemaines] = useState<Semaine[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingSemaines, setLoadingSemaines] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("tous");
  const [openId, setOpenId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Charger les sources
  useEffect(() => {
    fetch("/api/planification/sources")
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setSources(d.sources ?? []);
        if (d.sources?.length > 0) setActiveSourceId(d.sources[0].id);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingSources(false));
  }, []);

  // Charger les semaines quand la source change
  const loadSemaines = useCallback((sourceId: string) => {
    setLoadingSemaines(true);
    setError(null);
    setSemaines([]);
    fetch(`/api/planification/data?sourceId=${sourceId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setSemaines(d.semaines ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingSemaines(false));
  }, []);

  useEffect(() => {
    if (activeSourceId) { setFilter("tous"); loadSemaines(activeSourceId); }
  }, [activeSourceId, loadSemaines]);

  // Téléchargement PDF
  const handleDownload = async (fichier: Fichier) => {
    const key = (fichier.notion_page_id ?? fichier.url ?? "") + fichier.type;
    setDownloading(key);
    try {
      if (fichier.url) {
        // Fichier uploadé direct
        const a = document.createElement("a");
        a.href = fichier.url; a.download = fichier.name; a.target = "_blank";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        return;
      }
      if (fichier.notion_page_id) {
        // Via Notion API
        const type = fichier.type === "lecon" ? "lecon" : "evaluation";
        const res = await fetch(`/api/notion/download?pageId=${fichier.notion_page_id}&type=${type}`);
        const data = await res.json();
        if (!res.ok || data.error) { alert("Erreur : " + (data.error ?? "Fichier non disponible")); return; }
        for (const f of data.files as { name: string; url: string }[]) {
          const a = document.createElement("a");
          a.href = f.url; a.download = f.name; a.target = "_blank"; a.rel = "noopener noreferrer";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }
      }
    } catch (e) { console.error(e); alert("Erreur lors du téléchargement."); }
    finally { setDownloading(null); }
  };

  const activeSource = sources.find(s => s.id === activeSourceId);

  // Filtres supports disponibles dans la source active
  const supportsDispos = Array.from(new Set(semaines.filter(s => !s.is_header && s.support).map(s => s.support as string)));

  const filtered = semaines.filter(s => filter === "tous" || s.is_header || s.support === filter);
  const clean = filtered.filter((s, i) => {
    if (!s.is_header) return true;
    const n = filtered[i + 1];
    return n && !n.is_header;
  });

  const total = semaines.filter(s => !s.is_header).length;
  const totalFichiers = semaines.filter(s => !s.is_header && s.fichiers?.length > 0).length;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1000, margin: "0 auto" }}>

      {/* ── En-tête ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "#111827" }}>📅 Planification</h1>
          <p style={{ margin: 0, color: "#6B7280", fontSize: 13 }}>
            {total > 0 ? `${total} semaines · ${totalFichiers} avec documents` : "Sélectionne ou ajoute une planification"}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#111827", color: "#FFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ➕ Ajouter
        </button>
      </div>

      {/* ── Sélecteur de sources ── */}
      {!loadingSources && (
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {sources.map(src => (
            <button key={src.id} onClick={() => setActiveSourceId(src.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: activeSourceId === src.id ? `2px solid ${src.color}` : "2px solid #E5E7EB",
                background: activeSourceId === src.id ? src.color + "18" : "#FFF",
                color: activeSourceId === src.id ? src.color : "#6B7280",
              }}>
              <span style={{ fontSize: 12 }}>{SOURCE_ICONS[src.source_type]}</span>
              <span>{src.name}</span>
              {src.academic_year && <span style={{ fontSize: 11, opacity: 0.7 }}>{src.academic_year}</span>}
            </button>
          ))}
          {sources.length === 0 && !loadingSources && (
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Aucune planification — clique sur ➕ Ajouter pour commencer.</p>
          )}
        </div>
      )}

      {/* ── Filtres support ── */}
      {supportsDispos.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["tous", ...supportsDispos].map(s => {
            const c = SUPPORT_COLORS[s];
            const active = filter === s;
            return (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: active ? `2px solid ${c?.border ?? "#111827"}` : "2px solid transparent",
                background: active ? (c?.bg ?? "#111827") : "#F3F4F6",
                color: active ? (c?.text ?? "#FFF") : "#6B7280",
              }}>
                {s === "tous" ? "Toutes" : s}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Badge type source actif ── */}
      {activeSource && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: activeSource.color + "18", color: activeSource.color, fontWeight: 600, border: `1px solid ${activeSource.color}44` }}>
            {SOURCE_ICONS[activeSource.source_type]} {SOURCE_LABELS[activeSource.source_type]}
          </span>
          {activeSource.source_type === "notion" && (
            <a href={`https://www.notion.so/${activeSource.config.db_id?.replace(/-/g, "")}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: "#9CA3AF", textDecoration: "none" }}>
              ↗ Ouvrir dans Notion
            </a>
          )}
        </div>
      )}

      {/* ── États de chargement / erreur ── */}
      {loadingSemaines && (
        <div style={{ padding: 48, textAlign: "center", color: "#6B7280" }}>
          <div style={{ fontSize: 28 }}>📚</div>
          <p style={{ marginTop: 8 }}>Chargement…</p>
        </div>
      )}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#B91C1C" }}>Erreur</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#7F1D1D", fontFamily: "monospace" }}>{error}</p>
        </div>
      )}

      {/* ── Liste des semaines ── */}
      {!loadingSemaines && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {clean.map(s => {
            if (s.is_header) return (
              <div key={s.id} style={{ padding: "10px 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#9CA3AF", textTransform: "uppercase", marginTop: 12 }}>
                {s.date_label.replace("⬛", "").trim()}
              </div>
            );

            const sc = s.support ? SUPPORT_COLORS[s.support] : null;
            const open = openId === s.id;
            const evals = s.fichiers?.filter(f => f.type === "evaluation") ?? [];
            const lecons = s.fichiers?.filter(f => f.type === "lecon") ?? [];

            return (
              <div key={s.id} style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
                <div onClick={() => setOpenId(open ? null : s.id)}
                  style={{ display: "grid", gridTemplateColumns: "90px 80px 1fr auto", alignItems: "center", gap: 16, padding: "12px 16px", cursor: "pointer" }}>
                  <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>{s.date_label}</span>
                  {sc
                    ? <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, textAlign: "center" }}>{s.support}</span>
                    : <span />
                  }
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>{s.titres || <em style={{ color: "#9CA3AF" }}>—</em>}</p>
                    {s.competences && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280" }}>{s.competences.length > 90 ? s.competences.slice(0, 90) + "…" : s.competences}</p>}
                  </div>
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    {lecons.length > 0 && <span title="PDF leçon" style={{ fontSize: 14 }}>📄</span>}
                    {evals.length > 0 && <span title="Évaluation" style={{ fontSize: 14 }}>📝</span>}
                    <span style={{ fontSize: 11, color: "#9CA3AF", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s", display: "inline-block" }}>▶</span>
                  </div>
                </div>

                {open && (
                  <div style={{ borderTop: "1px solid #F3F4F6", padding: "16px 20px", background: "#FAFAFA", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
                    {s.objectifs && <div><p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".05em" }}>Objectifs</p><p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{s.objectifs}</p></div>}
                    {s.competences && <div><p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".05em" }}>Compétences</p><p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{s.competences}</p></div>}
                    {s.numerique && <div><p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".05em" }}>Numérique</p><p style={{ margin: 0, fontSize: 13, color: "#374151" }}>{s.numerique}</p></div>}

                    {/* Boutons téléchargement */}
                    {s.fichiers?.length > 0 && (
                      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {evals.map((f, i) => {
                          const key = (f.notion_page_id ?? f.url ?? "") + f.type + i;
                          return (
                            <button key={i} onClick={e => { e.stopPropagation(); handleDownload(f); }}
                              disabled={downloading === key}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: downloading === key ? "not-allowed" : "pointer", background: downloading === key ? "#9CA3AF" : "#1D4ED8", color: "#FFF" }}>
                              {downloading === key ? "⏳" : "⬇️"} {f.name}
                            </button>
                          );
                        })}
                        {lecons.map((f, i) => {
                          const key = (f.notion_page_id ?? f.url ?? "") + f.type + i;
                          return (
                            <button key={i} onClick={e => { e.stopPropagation(); handleDownload(f); }}
                              disabled={downloading === key}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: downloading === key ? "not-allowed" : "pointer", background: downloading === key ? "#9CA3AF" : "#374151", color: "#FFF" }}>
                              {downloading === key ? "⏳" : "⬇️"} {f.name}
                            </button>
                          );
                        })}
                        {s.notion_url && (
                          <a href={s.notion_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "#F3F4F6", color: "#6B7280", textDecoration: "none", border: "1px solid #E5E7EB" }}>
                            ↗ Voir dans Notion
                          </a>
                        )}
                      </div>
                    )}
                    {(!s.fichiers || s.fichiers.length === 0) && s.notion_url && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <a href={s.notion_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "#F3F4F6", color: "#6B7280", textDecoration: "none", border: "1px solid #E5E7EB" }}>
                          ↗ Voir dans Notion
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!loadingSemaines && clean.length === 0 && activeSourceId && !error && (
            <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF" }}>
              <div style={{ fontSize: 32 }}>📭</div>
              <p>Aucune semaine à afficher pour cette source.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modale ajout ── */}
      {showModal && (
        <ModalAjoutSource
          onClose={() => setShowModal(false)}
          onAdded={newSource => {
            setSources(prev => [...prev, newSource]);
            setActiveSourceId(newSource.id);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

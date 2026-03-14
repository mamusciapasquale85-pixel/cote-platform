"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
type Mode = "exercice" | "evaluation" | "activite";
type Niveau = "A1" | "A2" | "B1" | "B2";
type Langue = "nl" | "en";
type HistoryItem = { id: string; mode: Mode; subType: string; titre: string; contenu: string; createdAt: string; };

// ── Thèmes suggérés par RIT / niveau ───────────────────────────────────────
const THEMES_PAR_NIVEAU: Record<Niveau, string[]> = {
  A1: ["Se présenter", "La famille", "Les couleurs", "Les chiffres", "L'école", "Les animaux", "Les jours de la semaine", "La nourriture", "Les vêtements", "La maison"],
  A2: ["Les transports", "Le temps libre", "Faire des achats", "Chez le médecin", "Les sports", "La ville", "Les verbes modaux", "Le passé composé", "Les comparatifs", "Donner des directions"],
  B1: ["Les voyages", "L'environnement", "Le monde du travail", "Les médias", "La santé", "Les relations sociales", "L'immigration", "Les stéréotypes", "La technologie", "Le bénévolat"],
  B2: ["Les enjeux climatiques", "La politique", "L'économie", "Les réseaux sociaux", "L'intelligence artificielle", "La littérature flamande", "Les inégalités sociales", "Le marché du travail", "La démocratie", "L'identité culturelle"],
};

const EXERCICE_TYPES = [
  { id: "lacunes", label: "Texte à trous", emoji: "✏️", desc: "Mots manquants + banque" },
  { id: "qcm", label: "QCM", emoji: "🔘", desc: "10 questions 4 choix" },
  { id: "dialogue", label: "Dialogue", emoji: "💬", desc: "Conversation à compléter" },
  { id: "associer", label: "Association", emoji: "🔗", desc: "Relier mots/traductions" },
  { id: "traduction", label: "Traduction", emoji: "🔄", desc: "NL↔FR phrases" },
  { id: "conjugaison", label: "Conjugaison", emoji: "📝", desc: "Verbes en contexte" },
  { id: "remise_ordre", label: "Remise en ordre", emoji: "🔀", desc: "Phrases désordonnées" },
  { id: "lecture", label: "Compréhension", emoji: "📖", desc: "Texte + questions" },
  { id: "vocabulaire_images", label: "Vocabulaire", emoji: "📚", desc: "Listes bilingues" },
  { id: "mots_meles", label: "Mots mêlés", emoji: "🔤", desc: "Grille + corrigé" },
  { id: "flashcards", label: "Flashcards", emoji: "🗂️", desc: "20 cartes NL|FR|exemple" },
  { id: "kahoot_csv", label: "Kahoot", emoji: "🎮", desc: "10 questions format CSV" },
];
const EVALUATION_TYPES = [
  { id: "formative", label: "Formative", emoji: "📊", desc: "Non notée, diagnostic" },
  { id: "sommative", label: "Sommative", emoji: "🎓", desc: "Notée, fin séquence" },
  { id: "diagnostique", label: "Diagnostique", emoji: "🔍", desc: "Début de séquence" },
  { id: "oral", label: "Orale", emoji: "🎤", desc: "Production orale guidée" },
];
const ACTIVITE_TYPES = [
  { id: "jeu_role", label: "Jeu de rôle", emoji: "🎭", desc: "Simulation situation réelle" },
  { id: "debat", label: "Débat", emoji: "💡", desc: "Arguments pour/contre" },
  { id: "projet", label: "Mini-projet", emoji: "🏗️", desc: "Tâche collaborative" },
  { id: "jeu", label: "Jeu éducatif", emoji: "🎲", desc: "Bingo, memory, quiz" },
  { id: "chanson", label: "Chanson à trous", emoji: "🎵", desc: "Activité musicale" },
  { id: "video", label: "Activité vidéo", emoji: "🎬", desc: "Exploitation document" },
  { id: "lecture_classe", label: "Lecture partagée", emoji: "📖", desc: "Lecture + questions" },
  { id: "brainstorm", label: "Brainstorming", emoji: "🧠", desc: "Mise en commun guidée" },
];
const MODES = [
  { id: "exercice" as Mode, label: "Exercice", emoji: "✏️", desc: "Lacunes, QCM, flashcards…" },
  { id: "evaluation" as Mode, label: "Évaluation", emoji: "📋", desc: "Formative ou sommative" },
  { id: "activite" as Mode, label: "Activité", emoji: "🎯", desc: "Jeu, débat, projet…" },
];
const NIVEAUX: Niveau[] = ["A1", "A2", "B1", "B2"];

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}

// ── Rendu structuré du résultat ─────────────────────────────────────────────
function RenderContenu({ contenu }: { contenu: string }) {
  const lines = contenu.split("\n");
  return (
    <div style={{ fontSize: 14, lineHeight: 1.8, color: "#1e293b" }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: 8 }} />;
        // Titre de section (MAJUSCULES ou précédé de ##/*)
        if (/^(#{1,3}|\*\*|__)?[A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ][A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ\s\d:–\-()]{4,}(:|##)?$/.test(trimmed)) {
          return (
            <div key={i} style={{ marginTop: 16, marginBottom: 4, padding: "6px 12px", background: "#EFF6FF", borderLeft: "3px solid #0A84FF", borderRadius: "0 8px 8px 0", fontWeight: 700, fontSize: 13, color: "#0A63BF", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, "")}
            </div>
          );
        }
        // Corrigé
        if (/^(corrig[eé]|réponses?|answers?)/i.test(trimmed)) {
          return (
            <div key={i} style={{ marginTop: 16, padding: "6px 12px", background: "#F0FDF4", borderLeft: "3px solid #22C55E", borderRadius: "0 8px 8px 0", fontWeight: 700, fontSize: 13, color: "#166534", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              ✓ {trimmed.replace(/^#+\s*/, "")}
            </div>
          );
        }
        // Ligne numérotée (exercice)
        if (/^\d+[.)]\s/.test(trimmed)) {
          return (
            <div key={i} style={{ padding: "3px 0 3px 4px", display: "flex", gap: 8 }}>
              <span style={{ color: "#0A84FF", fontWeight: 700, minWidth: 24, flexShrink: 0 }}>{trimmed.match(/^\d+/)?.[0]}.</span>
              <span>{trimmed.replace(/^\d+[.)]\s/, "")}</span>
            </div>
          );
        }
        // Flashcard (contient |)
        if (trimmed.includes("|") && trimmed.split("|").length >= 2) {
          const parts = trimmed.split("|").map(p => p.trim());
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8, padding: "4px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{parts[0]}</span>
              <span style={{ color: "#0A63BF" }}>{parts[1]}</span>
              <span style={{ color: "#64748b", fontStyle: "italic" }}>{parts[2] ?? ""}</span>
            </div>
          );
        }
        return <div key={i} style={{ paddingLeft: line.startsWith(" ") || line.startsWith("\t") ? 20 : 0 }}>{trimmed}</div>;
      })}
    </div>
  );
}

export default function GenerateurPage() {
  const [mode, setMode] = useState<Mode>("exercice");
  const [subType, setSubType] = useState("lacunes");
  const [niveau, setNiveau] = useState<Niveau>("A1");
  const [langue, setLangue] = useState<Langue>("nl");
  const [theme, setTheme] = useState("");
  const [contexte, setContexte] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    supabase.auth.getSession().then(({ data }) => { if (!data.session) window.location.href = "/login"; });
  }, []);

  useEffect(() => {
    try { const raw = localStorage.getItem("klasbook_gen_history"); if (raw) setHistory(JSON.parse(raw) as HistoryItem[]); } catch { /* */ }
  }, []);

  useEffect(() => {
    if (mode === "exercice") setSubType("lacunes");
    else if (mode === "evaluation") setSubType("formative");
    else setSubType("jeu_role");
  }, [mode]);

  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1400); return () => clearTimeout(t); }, [copied]);

  function saveToHistory(item: Omit<HistoryItem, "id" | "createdAt">) {
    const n: HistoryItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    const updated = [n, ...history].slice(0, 25);
    setHistory(updated);
    try { localStorage.setItem("klasbook_gen_history", JSON.stringify(updated)); } catch { /* */ }
  }

  async function onGenerate() {
    if (!theme.trim()) { setErrorMsg("Veuillez renseigner un thème."); return; }
    try {
      setLoading(true); setErrorMsg(null); setCopied(false); setSelectedHistory(null); setContenu(""); setTitre("");
      const res = await fetch("/api/generer-exercice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type_exercice: subType, niveau, langue, theme: theme.trim(), contexte_remediation: contexte.trim() || undefined }),
      });
      const payload = await res.json() as { exercice?: string; titre?: string; error?: string };
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error(payload.error || "La génération a échoué.");
      const t = payload.titre?.trim() || `${mode} – ${theme}`;
      const c = payload.exercice?.trim() || "";
      setTitre(t); setContenu(c);
      saveToHistory({ mode, subType, titre: t, contenu: c });
    } catch (e) { setErrorMsg(toNiceError(e)); } finally { setLoading(false); }
  }

  async function onCopy() {
    const text = selectedHistory ? selectedHistory.contenu : contenu;
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch (e) { setErrorMsg(toNiceError(e)); }
  }

  async function onDownloadPdf() {
    const displayContenu = selectedHistory ? selectedHistory.contenu : contenu;
    const displayTitre = selectedHistory ? selectedHistory.titre : titre;
    if (!displayContenu.trim()) return;
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 14, contentW = pageW - margin * 2;
      doc.setFillColor(255, 59, 48); doc.rect(0, 0, pageW / 2, 18, "F");
      doc.setFillColor(10, 132, 255); doc.rect(pageW / 2, 0, pageW / 2, 18, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("✦ Klasbook", margin, 12);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(new Date().toLocaleDateString("fr-BE"), pageW - margin, 12, { align: "right" });
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      const titleLines = doc.splitTextToSize(displayTitre || "Document", contentW) as string[];
      doc.text(titleLines, margin, 28);
      let y = 28 + titleLines.length * 7 + 4;
      doc.setFontSize(9); doc.setFillColor(239, 246, 255); doc.setDrawColor(186, 230, 253);
      doc.roundedRect(margin, y, 56, 6, 2, 2, "FD"); doc.setTextColor(14, 116, 144);
      doc.text(`${mode} • ${niveau} • ${langue.toUpperCase()}`, margin + 2, y + 4.2);
      y += 11; doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4); doc.line(margin, y, pageW - margin, y); y += 7;
      doc.setTextColor(30, 41, 59);
      for (const raw of displayContenu.split("\n")) {
        const line = raw.trim();
        if (!line) { y += 3; continue; }
        if (y > pageH - 14) { doc.addPage(); y = 18; }
        if (/^[A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ][A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ\s:–-]{4,}$/.test(line)) {
          doc.setFillColor(239, 246, 255); doc.rect(margin, y - 3.5, contentW, 7, "F");
          doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(10, 132, 255); doc.text(line, margin + 2, y + 1);
          doc.setTextColor(30, 41, 59); y += 9; continue;
        }
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        const w = doc.splitTextToSize(line, contentW) as string[]; doc.text(w, margin, y); y += w.length * 5 + 1;
      }
      const total = (doc.internal as { getNumberOfPages?: () => number }).getNumberOfPages?.() ?? 1;
      for (let p = 1; p <= total; p++) {
        doc.setPage(p); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
        doc.text("Klasbook – LAB Marie Curie", margin, pageH - 5); doc.text(`Page ${p} / ${total}`, pageW - margin, pageH - 5, { align: "right" });
      }
      const safe = (displayTitre || "export").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
      doc.save(`${safe}.pdf`);
    } catch (e) { setErrorMsg(toNiceError(e)); }
  }

  const currentTypes = mode === "exercice" ? EXERCICE_TYPES : mode === "evaluation" ? EVALUATION_TYPES : ACTIVITE_TYPES;
  const displayContenu = selectedHistory ? selectedHistory.contenu : contenu;
  const displayTitre = selectedHistory ? selectedHistory.titre : titre;
  const hasDisplay = displayContenu.trim().length > 0;
  const themesSuggeres = THEMES_PAR_NIVEAU[niveau];
  const currentSubType = currentTypes.find(t => t.id === subType);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, minHeight: "calc(100vh - 140px)" }}>

      {/* ── PANNEAU GAUCHE ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Mode */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>Mode</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{ padding: "9px 12px", borderRadius: 10, border: mode === m.id ? "2px solid #0A84FF" : "1.5px solid #E5E7EB", background: mode === m.id ? "#EFF6FF" : "#FFF", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: mode === m.id ? "#0A63BF" : "#111827" }}>{m.emoji} {m.label}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Type d'exercice */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>Type</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {currentTypes.map(t => (
              <button key={t.id} onClick={() => setSubType(t.id)}
                title={t.desc}
                style={{ padding: "5px 9px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: subType === t.id ? "2px solid #0A84FF" : "1.5px solid #E5E7EB", background: subType === t.id ? "#EFF6FF" : "#FFF", color: subType === t.id ? "#0A63BF" : "#374151", fontWeight: subType === t.id ? 700 : 500 }}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          {currentSubType && (
            <div style={{ marginTop: 8, padding: "6px 10px", background: "#F0FDF4", borderRadius: 8, fontSize: 12, color: "#166534", fontWeight: 500 }}>
              💡 {currentSubType.desc}
            </div>
          )}
        </div>

        {/* Niveau + Langue */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", padding: 14, display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Niveau</div>
            <div style={{ display: "flex", gap: 4 }}>
              {NIVEAUX.map(n => (
                <button key={n} onClick={() => setNiveau(n)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, border: niveau === n ? "2px solid #0A84FF" : "1.5px solid #E5E7EB", background: niveau === n ? "#EFF6FF" : "#FFF", color: niveau === n ? "#0A63BF" : "#374151" }}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Langue</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["nl", "en"] as Langue[]).map(l => (
                <button key={l} onClick={() => setLangue(l)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, border: langue === l ? "2px solid #0A84FF" : "1.5px solid #E5E7EB", background: langue === l ? "#EFF6FF" : "#FFF", color: langue === l ? "#0A63BF" : "#374151" }}>
                  {l === "nl" ? "🇳🇱 NL" : "🇬🇧 EN"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Thème + suggestions */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", padding: 14, display: "grid", gap: 8 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>Thème *</label>
            <input type="text" value={theme} onChange={e => setTheme(e.target.value)}
              placeholder="Ex: les transports, verbes modaux…"
              style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: "1.5px solid #E5E7EB", fontSize: 13, boxSizing: "border-box", outline: "none" }} />
          </div>
          {/* Suggestions rapides */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>Suggestions {niveau}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {themesSuggeres.slice(0, 8).map(t => (
                <button key={t} onClick={() => setTheme(t)}
                  style={{ padding: "3px 8px", borderRadius: 20, fontSize: 11, cursor: "pointer", border: theme === t ? "1.5px solid #0A84FF" : "1px solid #E5E7EB", background: theme === t ? "#EFF6FF" : "#F9FAFB", color: theme === t ? "#0A63BF" : "#6B7280", fontWeight: 500 }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>Contexte / RIT (optionnel)</label>
            <textarea value={contexte} onChange={e => setContexte(e.target.value)} rows={2}
              placeholder="Ex: chapitre 3 Tandem Brio RIT 4, objectif B1…"
              style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: "1.5px solid #E5E7EB", fontSize: 12, resize: "none", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
          </div>
        </div>

        <button onClick={() => void onGenerate()} disabled={loading}
          style={{ padding: "12px", borderRadius: 12, border: "none", background: loading ? "#9CA3AF" : GRADIENT, color: "#fff", fontWeight: 800, fontSize: 15, cursor: loading ? "wait" : "pointer" }}>
          {loading ? "⏳ Génération…" : "✨ Générer"}
        </button>

        {errorMsg && (
          <div style={{ borderRadius: 10, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#991B1B", padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Historique */}
        {history.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <button onClick={() => setShowHistory(v => !v)}
              style={{ width: "100%", padding: "11px 14px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#111827" }}>
              <span>🕒 Historique ({history.length})</span>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>{showHistory ? "▲" : "▼"}</span>
            </button>
            {showHistory && (
              <div style={{ borderTop: "1px solid #F3F4F6", maxHeight: 200, overflowY: "auto" }}>
                {history.map(h => (
                  <button key={h.id} onClick={() => { setSelectedHistory(h); setShowHistory(false); }}
                    style={{ width: "100%", padding: "8px 14px", background: selectedHistory?.id === h.id ? "#EFF6FF" : "none", border: "none", borderBottom: "1px solid #F3F4F6", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.titre}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                      {MODES.find(m => m.id === h.mode)?.emoji} {EXERCICE_TYPES.find(t => t.id === h.subType)?.label ?? h.subType} · {new Date(h.createdAt).toLocaleDateString("fr-BE")}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── PANNEAU DROIT ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 520 }}>

          {hasDisplay ? (
            <>
              <div style={{ padding: "14px 18px", background: "#F8FAFC", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>📄 {displayTitre}</div>
                  {selectedHistory && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Depuis l'historique</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {selectedHistory && <button onClick={() => setSelectedHistory(null)} style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>✕ Fermer</button>}
                </div>
              </div>
              <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
                <RenderContenu contenu={displayContenu} />
              </div>
            </>
          ) : loading ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#6B7280", gap: 12 }}>
              <div style={{ fontSize: 40 }}>🤖</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>L'IA génère votre contenu…</div>
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>10 à 25 secondes selon le type</div>
              <div style={{ fontSize: 12, color: "#CBD5E1", marginTop: 4 }}>Type : {currentSubType?.emoji} {currentSubType?.label} · {niveau} · {langue.toUpperCase()}</div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9CA3AF", gap: 8 }}>
              <div style={{ fontSize: 48 }}>✨</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#374151" }}>Prêt à générer</div>
              <div style={{ fontSize: 13 }}>Choisis un type, un thème, puis clique sur Générer</div>
              {theme && <div style={{ marginTop: 8, padding: "6px 14px", background: "#EFF6FF", borderRadius: 20, fontSize: 13, color: "#0A63BF", fontWeight: 600 }}>🎯 {theme}</div>}
            </div>
          )}
        </div>

        {hasDisplay && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => void onCopy()} style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {copied ? "✅ Copié !" : "📋 Copier"}
            </button>
            <button onClick={() => void onDownloadPdf()} style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              📄 PDF
            </button>
            <button onClick={() => { setContenu(""); setTitre(""); setSelectedHistory(null); }}
              style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              🔄 Nouveau
            </button>
            <div style={{ marginLeft: "auto", padding: "9px 14px", borderRadius: 10, background: "#F9FAFB", fontSize: 12, color: "#9CA3AF" }}>
              {displayContenu.split("\n").length} lignes · {displayContenu.length} caractères
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

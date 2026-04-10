"use client";
import { useEffect, useMemo, useState } from "react";

type ExercicePropose = {
  titre: string;
  contenu: string;
  subject: string;
  type_exercice: string;
  niveau: string;
};

interface GenererExerciceModalProps {
  remediationId: string;
  attendu?: string;
  evaluationTitre?: string;
  eleveNom?: string;
  /** Matière pré-détectée ('nl', 'en', 'mathematiques'…) */
  subject?: string;
  /** Niveau pré-détecté ('A1', '1S'…) */
  niveau?: string;
  /** Exercice déjà généré en arrière-plan (Option B) */
  exercicePropose?: ExercicePropose;
  onClose: () => void;
}

type Langue = "nl" | "en";
type Niveau = "A1" | "A2" | "B1" | "B2";
type TypeExerciceOption = { id: string; label: string; emoji: string };
type GenerateResponse = { exercice?: string; titre?: string; error?: string };

const EXERCISE_TYPES: TypeExerciceOption[] = [
  { id: "lacunes", label: "Texte à trous", emoji: "✏️" },
  { id: "qcm", label: "QCM", emoji: "🔘" },
  { id: "mots_meles", label: "Mots mêlés", emoji: "🔤" },
  { id: "associer", label: "Association", emoji: "🔗" },
  { id: "dialogue", label: "Dialogue", emoji: "💬" },
  { id: "vocabulaire_images", label: "Vocabulaire", emoji: "📚" },
  { id: "traduction", label: "Traduction", emoji: "🔄" },
  { id: "conjugaison", label: "Conjugaison", emoji: "📝" },
  { id: "remise_ordre", label: "Remise en ordre", emoji: "🔀" },
  { id: "lecture", label: "Compréhension", emoji: "📖" },
  { id: "flashcards", label: "Flashcards", emoji: "🗂️" },
  { id: "kahoot_csv", label: "Kahoot CSV", emoji: "🎮" },
];

const NIVEAUX: Niveau[] = ["A1", "A2", "B1", "B2"];
const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}

function sanitizeFileName(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 96);
}

function ExerciceRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 1.8, color: "#1e293b" }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: 10 }} />;
        if (/^#{1,3}\s/.test(trimmed)) {
          const level = (trimmed.match(/^(#+)/) ?? [""])[0].length;
          const text = trimmed.replace(/^#+\s/, "");
          return <div key={i} style={{ fontWeight: 900, fontSize: level === 1 ? 16 : level === 2 ? 14 : 13, color: level === 1 ? "#0A84FF" : "#FF3B30", marginTop: 16, marginBottom: 6, textTransform: level === 1 ? "uppercase" : "none", letterSpacing: level === 1 ? "0.06em" : 0 }}>{text}</div>;
        }
        if (/^[A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ][A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ\s:–\-]{5,}$/.test(trimmed)) {
          return <div key={i} style={{ fontWeight: 900, fontSize: 12, color: "#0A84FF", marginTop: 16, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid rgba(10,132,255,0.2)", paddingBottom: 4 }}>{trimmed}</div>;
        }
        if (/^(corrig[eé]|réponses?|answers?|oplossing|CORRIGÉ)/i.test(trimmed)) {
          return <div key={i} style={{ fontWeight: 800, color: "#15803D", marginTop: 16, marginBottom: 6, padding: "6px 10px", background: "rgba(34,197,94,0.08)", borderRadius: 8, borderLeft: "3px solid #22c55e" }}>✅ {trimmed}</div>;
        }
        if (/^(\d+[.):]|[A-Z][.):])\s/.test(trimmed)) {
          return <div key={i} style={{ padding: "3px 0 3px 16px", borderLeft: "3px solid #e2e8f0", marginBottom: 3, color: "#334155" }}>{trimmed}</div>;
        }
        if (/^[-•*]\s/.test(trimmed)) {
          return <div key={i} style={{ padding: "2px 0 2px 16px", color: "#475569" }}>· {trimmed.slice(2)}</div>;
        }
        if (trimmed.includes("|") && trimmed.split("|").length >= 2) {
          const parts = trimmed.split("|").map(p => p.trim());
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: `repeat(${parts.length}, 1fr)`, gap: 8, padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
              {parts.map((p, j) => <span key={j} style={{ fontSize: 13, color: j === 0 ? "#1e293b" : "#64748b" }}>{p}</span>)}
            </div>
          );
        }
        return <div key={i} style={{ color: "#374151", marginBottom: 1 }}>{trimmed}</div>;
      })}
    </div>
  );
}

/** Déduire la langue depuis le subject ID */
function subjectToLangue(subject: string | undefined): Langue {
  if (subject === "en") return "en";
  return "nl";
}

/** Déduire le type d'exercice par défaut selon la matière */
function subjectToTypeExercice(subject: string | undefined): string {
  if (!subject) return "lacunes";
  const map: Record<string, string> = {
    nl: "lacunes", en: "lacunes",
    mathematiques: "calcul", sciences: "qcm_sc",
    histoire: "qcm_hist", geographie: "qcm_geo", francais: "lecture_fr",
  };
  return map[subject] ?? "lacunes";
}

export default function GenererExerciceModal({ remediationId, attendu, evaluationTitre, eleveNom, subject, niveau: niveauProp, exercicePropose, onClose }: GenererExerciceModalProps) {
  const [typeExercice, setTypeExercice] = useState(
    exercicePropose?.type_exercice ?? subjectToTypeExercice(subject)
  );
  const [niveau, setNiveau] = useState<Niveau>(
    (exercicePropose?.niveau ?? niveauProp ?? "A1") as Niveau
  );
  const [theme, setTheme] = useState((attendu ?? "").trim());
  const [langue, setLangue] = useState<Langue>(subjectToLangue(exercicePropose?.subject ?? subject));
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Option B : pré-remplir avec l'exercice proposé si disponible
  const [titre, setTitre] = useState(exercicePropose?.titre ?? "");
  const [exercice, setExercice] = useState(exercicePropose?.contenu ?? "");
  const [copied, setCopied] = useState(false);

  const hasResult = exercice.trim().length > 0;

  const contexteRemediation = useMemo(() => {
    const parts: string[] = [];
    if (evaluationTitre?.trim()) parts.push(`Évaluation: ${evaluationTitre.trim()}`);
    if (eleveNom?.trim()) parts.push(`Élève: ${eleveNom.trim()}`);
    return parts.join(" | ");
  }, [evaluationTitre, eleveNom]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  async function onGenerate() {
    try {
      setLoading(true); setErrorMsg(null); setCopied(false);
      const res = await fetch("/api/generer-exercice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_exercice: typeExercice, niveau,
          theme: theme.trim() || attendu?.trim() || "Remédiation ciblée",
          langue, attendu: attendu?.trim() || undefined,
          contexte_remediation: contexteRemediation || undefined,
        }),
      });
      const payload = (await res.json()) as GenerateResponse;
      if (!res.ok) throw new Error(payload.error || "La génération a échoué.");
      setTitre(payload.titre?.trim() || "Exercice généré");
      setExercice(payload.exercice?.trim() || "");
    } catch (e) { setErrorMsg(toNiceError(e)); }
    finally { setLoading(false); }
  }

  async function onCopy() {
    try { await navigator.clipboard.writeText(exercice); setCopied(true); }
    catch (e) { setErrorMsg(toNiceError(e)); }
  }

  async function onDownloadPdf() {
    if (!hasResult) return;
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 16;
      const contentW = pageW - margin * 2;

      const drawHeader = (isFirst: boolean) => {
        // Gradient simulé : rectangle rouge gauche + rectangle bleu droite
        const headerH = isFirst ? 28 : 14;
        doc.setFillColor(255, 59, 48); // #FF3B30
        doc.rect(0, 0, pageW * 0.55, headerH, "F");
        doc.setFillColor(10, 132, 255); // #0A84FF
        doc.rect(pageW * 0.45, 0, pageW * 0.55, headerH, "F");
        // Zone de chevauchement blendée (simulée par un rectangle intermédiaire)
        doc.setFillColor(100, 80, 200);
        doc.rect(pageW * 0.42, 0, pageW * 0.16, headerH, "F");

        if (isFirst) {
          // Logo Klasbook
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(16);
          doc.text("✦ Klasbook", margin, 12);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text("La gestion de classe simplifiée", margin, 18);

          // Date + info droite
          const dateStr = new Date().toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" });
          doc.setFontSize(9);
          doc.text(dateStr, pageW - margin, 12, { align: "right" });
          if (eleveNom?.trim()) {
            doc.text(`👤 ${eleveNom.trim()}`, pageW - margin, 18, { align: "right" });
          }
        } else {
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("✦ Klasbook", margin, 9);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          const dateStr = new Date().toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" });
          doc.text(dateStr, pageW - margin, 9, { align: "right" });
        }
      };

      // Page 1 — header complet
      drawHeader(true);

      // Titre de l'exercice
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      const finalTitle = titre || "Exercice";
      const titleLines = doc.splitTextToSize(finalTitle, contentW) as string[];
      doc.text(titleLines, margin, 38);

      let y = 38 + titleLines.length * 7 + 4;

      // Chips d'info
      const chips: { label: string; color: [number, number, number] }[] = [];
      if (niveau) chips.push({ label: `Niveau ${niveau}`, color: [10, 132, 255] });
      if (langue) chips.push({ label: langue === "nl" ? "🇳🇱 Néerlandais" : "🇬🇧 Anglais", color: [255, 59, 48] });
      if (eleveNom?.trim()) chips.push({ label: `👤 ${eleveNom.trim()}`, color: [100, 100, 100] });

      let chipX = margin;
      for (const chip of chips) {
        doc.setFontSize(8);
        const [r, g, b] = chip.color;
        doc.setFillColor(r, g, b);
        const chipW = doc.getTextWidth(chip.label) + 8;
        doc.roundedRect(chipX, y - 1, chipW, 7, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(chip.label, chipX + 4, y + 4.2);
        chipX += chipW + 6;
      }
      y += 12;

      // Ligne de séparation
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 8;

      // Contenu
      doc.setTextColor(30, 41, 59);
      const lines = exercice.split("\n");

      for (const raw of lines) {
        const line = raw.trim();

        if (y > pageH - 20) {
          // Footer
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text("Klasbook — Exercice généré par IA", margin, pageH - 5);

          doc.addPage();
          drawHeader(false);
          y = 22;
          doc.setTextColor(30, 41, 59);
        }

        if (!line) { y += 4; continue; }

        // Titre de section (majuscules)
        if (/^[A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ][A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ\s:–\-]{5,}$/.test(line) || /^#{1,3}\s/.test(line)) {
          const text = line.replace(/^#+\s/, "");
          doc.setFillColor(239, 246, 255);
          doc.roundedRect(margin - 2, y - 4, contentW + 4, 9, 2, 2, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(10, 132, 255);
          doc.text(text, margin, y + 1);
          doc.setTextColor(30, 41, 59);
          y += 12;
          continue;
        }

        // Corrigé
        if (/^(corrig[eé]|réponses?|answers?|CORRIGÉ)/i.test(line)) {
          y += 4;
          doc.setFillColor(240, 253, 244);
          doc.roundedRect(margin - 2, y - 4, contentW + 4, 9, 2, 2, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(22, 163, 74);
          doc.text("✓ " + line, margin, y + 1);
          doc.setTextColor(30, 41, 59);
          y += 12;
          continue;
        }

        // Items numérotés / bullets
        if (/^(\d+[.):]|[A-Z][.):]|[-•*])\s/.test(line)) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          const wrapped = doc.splitTextToSize(line, contentW - 4) as string[];
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.8);
          doc.line(margin + 1, y - 1, margin + 1, y + (wrapped.length - 1) * 5 + 1);
          doc.text(wrapped, margin + 5, y);
          y += wrapped.length * 5 + 2;
          continue;
        }

        // Séparateur ---
        if (/^---+$/.test(line)) {
          y += 3;
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.line(margin, y, pageW - margin, y);
          y += 6;
          continue;
        }

        // Texte normal
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const wrapped = doc.splitTextToSize(line, contentW) as string[];
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5 + 1;
      }

      // Footer toutes pages
      const totalPages = (doc.internal as { getNumberOfPages?: () => number }).getNumberOfPages?.() ?? 1;
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("Klasbook — Exercice généré par IA — LAB Marie Curie", margin, pageH - 5);
        doc.text(`Page ${p} / ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
      }

      const filename = sanitizeFileName(finalTitle) || "exercice_klasbook";
      doc.save(`${filename}.pdf`);
    } catch (e) { setErrorMsg(toNiceError(e)); }
  }

  function onReset() { setExercice(""); setTitre(""); setErrorMsg(null); setCopied(false); }
  const selectedType = EXERCISE_TYPES.find(t => t.id === typeExercice);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(3px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(900px, 98vw)", maxHeight: "92vh", overflowY: "auto", borderRadius: 20, background: "#f8fafc", boxShadow: "0 32px 80px rgba(15,23,42,0.32)", display: "flex", flexDirection: "column" }}>

        {/* HEADER */}
        <div style={{ padding: "18px 20px", borderRadius: "20px 20px 0 0", background: GRADIENT, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>✨ Générateur d'exercices IA</div>
            {eleveNom && <div style={{ fontSize: 13, opacity: 0.9, marginTop: 3 }}>👤 {eleveNom} {attendu ? `— ${attendu}` : ""}</div>}
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Propulsé par Claude Sonnet</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 10, padding: "6px 10px", fontWeight: 800, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 16 }}>

          {/* TYPE */}
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, color: "#64748b", display: "block", marginBottom: 8 }}>TYPE D'EXERCICE</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXERCISE_TYPES.map(t => (
                <button key={t.id} onClick={() => setTypeExercice(t.id)} style={{
                  padding: "7px 13px", borderRadius: 99,
                  border: typeExercice === t.id ? "2px solid #0A84FF" : "1.5px solid #e2e8f0",
                  background: typeExercice === t.id ? "#eff6ff" : "#fff",
                  color: typeExercice === t.id ? "#0A63BF" : "#334155",
                  fontWeight: typeExercice === t.id ? 700 : 500, fontSize: 13, cursor: "pointer",
                }}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* NIVEAU + LANGUE */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontWeight: 700, fontSize: 13, color: "#64748b", display: "block", marginBottom: 8 }}>NIVEAU</label>
              <div style={{ display: "flex", gap: 8 }}>
                {NIVEAUX.map(n => (
                  <button key={n} onClick={() => setNiveau(n)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 10,
                    border: niveau === n ? "2px solid #0A84FF" : "1.5px solid #e2e8f0",
                    background: niveau === n ? "#eff6ff" : "#fff",
                    color: niveau === n ? "#0A63BF" : "#334155",
                    fontWeight: niveau === n ? 800 : 500, fontSize: 13, cursor: "pointer",
                  }}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: 13, color: "#64748b", display: "block", marginBottom: 8 }}>LANGUE</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["nl", "en"] as Langue[]).map(l => (
                  <button key={l} onClick={() => setLangue(l)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 10,
                    border: langue === l ? "2px solid #0A84FF" : "1.5px solid #e2e8f0",
                    background: langue === l ? "#eff6ff" : "#fff",
                    color: langue === l ? "#0A63BF" : "#334155",
                    fontWeight: langue === l ? 800 : 500, fontSize: 13, cursor: "pointer",
                  }}>{l === "nl" ? "🇳🇱 NL" : "🇬🇧 EN"}</button>
                ))}
              </div>
            </div>
          </div>

          {/* THÈME */}
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, color: "#64748b", display: "block", marginBottom: 8 }}>THÈME / LACUNE CIBLÉE</label>
            <input type="text" value={theme} onChange={e => setTheme(e.target.value)}
              placeholder="Ex: Les verbes modaux, le présent, le vocabulaire de la famille…"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#fff", boxSizing: "border-box", outline: "none" }} />
          </div>

          {/* BOUTON */}
          <button onClick={() => void onGenerate()} disabled={loading} style={{
            padding: "13px", borderRadius: 12, border: "none",
            background: loading ? "#94a3b8" : GRADIENT,
            color: "#fff", fontWeight: 800, fontSize: 15, cursor: loading ? "wait" : "pointer",
          }}>
            {loading ? "⏳ Génération en cours… (15-30 secondes)" : `✨ Générer — ${selectedType?.emoji} ${selectedType?.label}`}
          </button>

          {errorMsg && (
            <div style={{ borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", padding: "10px 14px", fontSize: 13 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Bandeau "proposition auto" si exercice pré-généré en background */}
          {hasResult && exercicePropose && exercice === exercicePropose.contenu && (
            <div style={{
              borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700,
              background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.4)",
              color: "#15803D", display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>✅</span>
              <span>Exercice généré automatiquement par Klasbook — vérifie et adapte si nécessaire</span>
            </div>
          )}

          {(hasResult || loading) && (
            <div style={{ borderRadius: 14, border: "1.5px solid #e2e8f0", background: "#fff", overflow: "hidden" }}>
              {hasResult && (
                <div style={{ padding: "12px 16px", background: GRADIENT, color: "#fff", fontWeight: 800, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📄 {titre}</span>
                  <span style={{ opacity: 0.8, fontSize: 11 }}>Claude Haiku · Auto</span>
                </div>
              )}
              <div style={{ padding: 16, minHeight: 200, maxHeight: "45vh", overflowY: "auto" }}>
                {loading ? (
                  <div style={{ color: "#64748b", textAlign: "center", padding: "40px 0" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                    <div style={{ fontWeight: 600 }}>Claude Sonnet génère votre exercice…</div>
                    <div style={{ fontSize: 13, marginTop: 6, color: "#94a3b8" }}>Qualité optimale · 15 à 30 secondes selon le type.</div>
                  </div>
                ) : (
                  <ExerciceRenderer text={exercice} />
                )}
              </div>
            </div>
          )}

          {hasResult && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button onClick={() => void onCopy()} style={{ padding: "9px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {copied ? "✅ Copié !" : "📋 Copier le texte"}
              </button>
              <button onClick={() => void onDownloadPdf()} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                📄 Télécharger PDF Klasbook
              </button>
              <button onClick={onReset} style={{ padding: "9px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                🔄 Nouvel exercice
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

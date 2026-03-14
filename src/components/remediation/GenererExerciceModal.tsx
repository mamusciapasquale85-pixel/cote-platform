"use client";
import { useEffect, useMemo, useState } from "react";

interface GenererExerciceModalProps {
  remediationId: string;
  attendu?: string;
  evaluationTitre?: string;
  eleveNom?: string;
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

// Rendu amélioré du contenu exercice
function ExerciceRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 1.7, color: "#1e293b" }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: 8 }} />;
        // Titres (ligne en majuscules ou commençant par chiffre+point ou numéro)
        if (/^[A-Z0-9ÉÀÈÙÂÊÎÔÛÄËÏÖÜ][A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ\s:–-]{4,}$/.test(trimmed)) {
          return <div key={i} style={{ fontWeight: 800, fontSize: 13, color: "#0A84FF", marginTop: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{trimmed}</div>;
        }
        // Sections numérotées ex: "1)" "1." "A)"
        if (/^(\d+[.):]|[A-Z][.):]|[-•*])\s/.test(trimmed)) {
          return <div key={i} style={{ padding: "4px 0 4px 12px", borderLeft: "3px solid #e2e8f0", marginBottom: 2 }}>{trimmed}</div>;
        }
        // Corrigé / réponses
        if (/^(corrig[eé]|réponses?|answers?|oplossing)/i.test(trimmed)) {
          return <div key={i} style={{ fontWeight: 700, color: "#16a34a", marginTop: 10, marginBottom: 4 }}>✅ {trimmed}</div>;
        }
        return <div key={i}>{trimmed}</div>;
      })}
    </div>
  );
}

export default function GenererExerciceModal({ remediationId, attendu, evaluationTitre, eleveNom, onClose }: GenererExerciceModalProps) {
  const [typeExercice, setTypeExercice] = useState("lacunes");
  const [niveau, setNiveau] = useState<Niveau>("A1");
  const [theme, setTheme] = useState((attendu ?? "").trim());
  const [langue, setLangue] = useState<Langue>("nl");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [exercice, setExercice] = useState("");
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
      const margin = 14;
      const contentW = pageW - margin * 2;

      // Header gradient band
      doc.setFillColor(255, 59, 48);
      doc.rect(0, 0, pageW / 2, 18, "F");
      doc.setFillColor(10, 132, 255);
      doc.rect(pageW / 2, 0, pageW / 2, 18, "F");

      // Header text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("✦ Klasbook", margin, 12);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const dateStr = new Date().toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" });
      doc.text(dateStr, pageW - margin, 12, { align: "right" });

      // Titre exercice
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      const finalTitle = titre || "Exercice";
      const titleLines = doc.splitTextToSize(finalTitle, contentW) as string[];
      doc.text(titleLines, margin, 28);

      // Metadata chips
      let chipY = 28 + titleLines.length * 7 + 2;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      if (eleveNom?.trim()) {
        doc.setFillColor(240, 249, 255);
        doc.setDrawColor(186, 230, 253);
        doc.roundedRect(margin, chipY, 55, 6, 2, 2, "FD");
        doc.setTextColor(14, 116, 144);
        doc.text(`👤 ${eleveNom.trim()}`, margin + 2, chipY + 4.2);
        chipY += 9;
      }

      // Separator line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(margin, chipY + 2, pageW - margin, chipY + 2);

      // Body content
      let y = chipY + 8;
      doc.setTextColor(30, 41, 59);
      const lines = exercice.split("\n");

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) { y += 3; continue; }

        // Check page overflow
        if (y > pageH - 14) {
          doc.addPage();
          // Header on new page
          doc.setFillColor(255, 59, 48);
          doc.rect(0, 0, pageW / 2, 10, "F");
          doc.setFillColor(10, 132, 255);
          doc.rect(pageW / 2, 0, pageW / 2, 10, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.text("Klasbook", margin, 7);
          y = 18;
        }

        // Section title detection
        if (/^[A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ][A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ\s:–-]{4,}$/.test(line)) {
          doc.setFillColor(239, 246, 255);
          doc.rect(margin, y - 3.5, contentW, 7, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(10, 132, 255);
          doc.text(line, margin + 2, y + 1);
          doc.setTextColor(30, 41, 59);
          y += 9;
          continue;
        }

        // Corrigé
        if (/^(corrig[eé]|réponses?|answers?)/i.test(line)) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(22, 163, 74);
          const wrapped = doc.splitTextToSize("✓ " + line, contentW) as string[];
          doc.text(wrapped, margin, y);
          y += wrapped.length * 5.5 + 2;
          doc.setTextColor(30, 41, 59);
          continue;
        }

        // Numbered/bullet items
        if (/^(\d+[.):]|[A-Z][.):]|[-•*])\s/.test(line)) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          const wrapped = doc.splitTextToSize(line, contentW - 4) as string[];
          doc.text(wrapped, margin + 4, y);
          y += wrapped.length * 5 + 1;
          continue;
        }

        // Normal text
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const wrapped = doc.splitTextToSize(line, contentW) as string[];
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5 + 1;
      }

      // Footer
      const totalPages = (doc.internal as { getNumberOfPages?: () => number }).getNumberOfPages?.() ?? 1;
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Klasbook – LAB Marie Curie`, margin, pageH - 5);
        doc.text(`Page ${p} / ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
      }

      const filename = sanitizeFileName(finalTitle) || "exercice";
      doc.save(`${filename}.pdf`);
    } catch (e) { setErrorMsg(toNiceError(e)); }
  }

  function onReset() { setExercice(""); setTitre(""); setErrorMsg(null); setCopied(false); }

  const selectedType = EXERCISE_TYPES.find(t => t.id === typeExercice);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(3px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(900px, 98vw)", maxHeight: "92vh", overflowY: "auto", borderRadius: 20, background: "#f8fafc", boxShadow: "0 32px 80px rgba(15,23,42,0.32)", display: "flex", flexDirection: "column", gap: 0 }}>

        {/* HEADER */}
        <div style={{ padding: "18px 20px", borderRadius: "20px 20px 0 0", background: GRADIENT, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>✨ Générateur d'exercices IA</div>
            {eleveNom && <div style={{ fontSize: 13, opacity: 0.9, marginTop: 3 }}>👤 {eleveNom} {attendu ? `— ${attendu}` : ""}</div>}
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 10, padding: "6px 10px", fontWeight: 800, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 16 }}>

          {/* TYPE D'EXERCICE — grille de chips */}
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, color: "#64748b", display: "block", marginBottom: 8 }}>TYPE D'EXERCICE</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXERCISE_TYPES.map(t => (
                <button key={t.id} onClick={() => setTypeExercice(t.id)} style={{
                  padding: "7px 13px", borderRadius: 99, border: typeExercice === t.id ? "2px solid #0A84FF" : "1.5px solid #e2e8f0",
                  background: typeExercice === t.id ? "#eff6ff" : "#fff", color: typeExercice === t.id ? "#0A63BF" : "#334155",
                  fontWeight: typeExercice === t.id ? 700 : 500, fontSize: 13, cursor: "pointer", transition: "all 0.15s",
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
                    flex: 1, padding: "8px 0", borderRadius: 10, border: niveau === n ? "2px solid #0A84FF" : "1.5px solid #e2e8f0",
                    background: niveau === n ? "#eff6ff" : "#fff", color: niveau === n ? "#0A63BF" : "#334155",
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
                    flex: 1, padding: "8px 0", borderRadius: 10, border: langue === l ? "2px solid #0A84FF" : "1.5px solid #e2e8f0",
                    background: langue === l ? "#eff6ff" : "#fff", color: langue === l ? "#0A63BF" : "#334155",
                    fontWeight: langue === l ? 800 : 500, fontSize: 13, cursor: "pointer",
                  }}>{l === "nl" ? "🇳🇱 NL" : "🇬🇧 EN"}</button>
                ))}
              </div>
            </div>
          </div>

          {/* THÈME */}
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, color: "#64748b", display: "block", marginBottom: 8 }}>THÈME / LACUNE</label>
            <input type="text" value={theme} onChange={e => setTheme(e.target.value)} placeholder="Ex: Les verbes modaux, le présent, le vocabulaire de la famille…"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#fff", boxSizing: "border-box", outline: "none" }} />
          </div>

          {/* BOUTON GÉNÉRER */}
          <button onClick={() => void onGenerate()} disabled={loading} style={{
            padding: "12px", borderRadius: 12, border: "none", background: loading ? "#94a3b8" : GRADIENT,
            color: "#fff", fontWeight: 800, fontSize: 15, cursor: loading ? "wait" : "pointer", transition: "opacity 0.2s",
          }}>
            {loading ? "⏳ Génération en cours… (10-20 secondes)" : `✨ Générer — ${selectedType?.emoji} ${selectedType?.label}`}
          </button>

          {/* ERREUR */}
          {errorMsg && (
            <div style={{ borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", padding: "10px 14px", fontSize: 13 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* RÉSULTAT */}
          {(hasResult || loading) && (
            <div style={{ borderRadius: 14, border: "1.5px solid #e2e8f0", background: "#fff", overflow: "hidden" }}>
              {/* Titre résultat */}
              {hasResult && (
                <div style={{ padding: "12px 16px", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", fontWeight: 800, fontSize: 15, color: "#1e293b" }}>
                  📄 {titre}
                </div>
              )}
              <div style={{ padding: 16, minHeight: 200, maxHeight: "45vh", overflowY: "auto" }}>
                {loading ? (
                  <div style={{ color: "#64748b", textAlign: "center", padding: "40px 0" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                    <div style={{ fontWeight: 600 }}>L'IA génère votre exercice…</div>
                    <div style={{ fontSize: 13, marginTop: 6, color: "#94a3b8" }}>Cela prend 10 à 20 secondes selon le type.</div>
                  </div>
                ) : (
                  <ExerciceRenderer text={exercice} />
                )}
              </div>
            </div>
          )}

          {/* ACTIONS */}
          {hasResult && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button onClick={() => void onCopy()} style={{ padding: "9px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {copied ? "✅ Copié !" : "📋 Copier le texte"}
              </button>
              <button onClick={() => void onDownloadPdf()} style={{ padding: "9px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                📄 Télécharger PDF
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

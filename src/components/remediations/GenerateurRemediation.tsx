"use client";
import { useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Competence =
  | "grammaire"
  | "conjugaison"
  | "vocabulaire"
  | "comprehension_lecture"
  | "expression_ecrite"
  | "expression_orale"
  | "calcul"
  | "resolution_problemes"
  | "geometrie"
  | "algebre"
  | "sciences"
  | "histoire"
  | "geographie"
  | "francais";

type TypeExerciceOption = { id: string; label: string; emoji: string };
type GenerateResponse = { exercice?: string; titre?: string; error?: string };

// ─── Config ────────────────────────────────────────────────────────────────────

const EXERCISE_TYPES: TypeExerciceOption[] = [
  { id: "lacunes",    label: "Texte à trous",   emoji: "✏️" },
  { id: "qcm",        label: "QCM",              emoji: "🔘" },
  { id: "associer",   label: "Association",      emoji: "🔗" },
  { id: "conjugaison",label: "Conjugaison",      emoji: "📝" },
  { id: "lecture",    label: "Compréhension",    emoji: "📖" },
  { id: "expression_ecrite", label: "Expression écrite", emoji: "🖊️" },
  { id: "flashcards", label: "Flashcards",       emoji: "🗂️" },
];

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e)
    return String((e as { message: unknown }).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}

function ExerciceRenderer({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, lineHeight: 1.8, color: "#1e293b" }}>
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 8 }} />;
        if (/^#{1,3}\s/.test(t)) {
          const lvl = (t.match(/^(#+)/) ?? [""])[0].length;
          return (
            <div key={i} style={{ fontWeight: 900, fontSize: lvl === 1 ? 15 : 13, color: "#0A84FF", marginTop: 14, marginBottom: 4 }}>
              {t.replace(/^#+\s/, "")}
            </div>
          );
        }
        if (/^(corrig[eé]|réponses?|CORRIGÉ)/i.test(t)) {
          return (
            <div key={i} style={{ fontWeight: 800, color: "#15803D", marginTop: 12, padding: "5px 10px", background: "rgba(34,197,94,0.08)", borderRadius: 8, borderLeft: "3px solid #22c55e" }}>
              ✅ {t}
            </div>
          );
        }
        if (/^(\d+[.):]|[-•*])\s/.test(t)) {
          return <div key={i} style={{ padding: "2px 0 2px 14px", borderLeft: "3px solid #e2e8f0", marginBottom: 2, color: "#334155" }}>{t}</div>;
        }
        return <div key={i} style={{ color: "#374151", marginBottom: 1 }}>{t}</div>;
      })}
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface GenerateurRemediationProps {
  remediationId: string;
  eleveNom: string;
  niveau: string;
  theme?: string;
  competence?: Competence;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function GenerateurRemediation({
  remediationId,
  eleveNom,
  niveau,
  theme,
  competence,
}: GenerateurRemediationProps) {
  const [open, setOpen] = useState(false);
  const [typeExercice, setTypeExercice] = useState("lacunes");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [exercice, setExercice] = useState("");
  const [copied, setCopied] = useState(false);

  const hasResult = exercice.trim().length > 0;

  async function onGenerate() {
    setLoading(true);
    setErrorMsg(null);
    setCopied(false);
    try {
      const res = await fetch("/api/remediations/generer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remediationId,
          type_exercice: typeExercice,
          niveau,
          theme: theme?.trim() || "Remédiation ciblée",
          competence,
          eleve_nom: eleveNom,
        }),
      });
      const payload = (await res.json()) as GenerateResponse;
      if (!res.ok) throw new Error(payload.error || "La génération a échoué.");
      setTitre(payload.titre?.trim() || "Exercice généré");
      setExercice(payload.exercice?.trim() || "");
    } catch (e) {
      setErrorMsg(toNiceError(e));
    } finally {
      setLoading(false);
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(exercice);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (e) {
      setErrorMsg(toNiceError(e));
    }
  }

  function onReset() {
    setExercice("");
    setTitre("");
    setErrorMsg(null);
    setCopied(false);
  }

  // Collapsed state — just a button
  if (!open) {
    return (
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1.5px dashed rgba(10,132,255,0.4)",
            background: "rgba(10,132,255,0.05)",
            color: "#0A63BF",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          ✨ Générer un exercice IA
        </button>
      </div>
    );
  }

  // Expanded state
  const selectedType = EXERCISE_TYPES.find((t) => t.id === typeExercice);

  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: 12,
        border: "1.5px solid rgba(10,132,255,0.22)",
        background: "#f8fafc",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          background: GRADIENT,
          color: "#fff",
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 13 }}>✨ Générateur IA</span>
        <button
          type="button"
          onClick={() => { setOpen(false); onReset(); }}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.35)",
            color: "#fff",
            borderRadius: 7,
            padding: "2px 8px",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: "12px", display: "grid", gap: 10 }}>
        {/* Type selector */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Type d'exercice
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {EXERCISE_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeExercice(t.id)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 99,
                  border: typeExercice === t.id ? "2px solid #0A84FF" : "1.5px solid #e2e8f0",
                  background: typeExercice === t.id ? "#eff6ff" : "#fff",
                  color: typeExercice === t.id ? "#0A63BF" : "#475569",
                  fontWeight: typeExercice === t.id ? 700 : 500,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Context chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {niveau && (
            <span style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(10,132,255,0.1)", color: "#0A63BF", fontSize: 11, fontWeight: 700 }}>
              {niveau}
            </span>
          )}
          {theme && (
            <span style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(255,59,48,0.08)", color: "#B91C1C", fontSize: 11, fontWeight: 600 }}>
              {theme}
            </span>
          )}
          {competence && (
            <span style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(100,116,139,0.1)", color: "#475569", fontSize: 11, fontWeight: 600 }}>
              {competence.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={loading}
          style={{
            padding: "10px",
            borderRadius: 10,
            border: "none",
            background: loading ? "#94a3b8" : GRADIENT,
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading
            ? "⏳ Génération… (15-30 s)"
            : `✨ Générer — ${selectedType?.emoji} ${selectedType?.label}`}
        </button>

        {/* Error */}
        {errorMsg && (
          <div style={{ borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", padding: "8px 12px", fontSize: 12 }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Result */}
        {(hasResult || loading) && (
          <div style={{ borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", overflow: "hidden" }}>
            {hasResult && (
              <div style={{ padding: "8px 12px", background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>📄 {titre}</span>
                <span style={{ opacity: 0.7, fontSize: 10 }}>Claude Sonnet</span>
              </div>
            )}
            <div style={{ padding: 12, maxHeight: 320, overflowY: "auto" }}>
              {loading ? (
                <div style={{ color: "#64748b", textAlign: "center", padding: "30px 0" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Claude génère votre exercice…</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: "#94a3b8" }}>15 à 30 secondes</div>
                </div>
              ) : (
                <ExerciceRenderer text={exercice} />
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {hasResult && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void onCopy()}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
            >
              {copied ? "✅ Copié !" : "📋 Copier"}
            </button>
            <button
              type="button"
              onClick={onReset}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
            >
              🔄 Nouvel exercice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

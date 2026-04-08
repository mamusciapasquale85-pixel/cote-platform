"use client";
import type { PronunciationApiResult } from "./VocalRecorder";

type Props = { result: PronunciationApiResult };

export default function PronunciationFeedback({ result }: Props) {
  const { pronScore, accuracyScore, fluencyScore, completenessScore, recognizedText, feedback, words } = result;

  const scoreColor = (s: number) => s >= 80 ? "#10b981" : s >= 60 ? "#f59e0b" : "#ef4444";
  const errorColor = (type: string) => type === "None" ? "#10b981" : type === "Mispronunciation" ? "#ef4444" : "#f59e0b";

  const banner = pronScore >= 80
    ? { icon: "✅", label: "Excellent ! Bonne prononciation.", bg: "#dcfce7", color: "#166534", border: "#bbf7d0" }
    : pronScore >= 60
    ? { icon: "⚠️", label: "Pas mal, il y a quelques points à améliorer.", bg: "#fef9c3", color: "#854d0e", border: "#fde68a" }
    : { icon: "❌", label: "À retravailler. Écoute le modèle et réessaie.", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" };

  const errorWords = words.filter(w => w.errorType !== "None");

  const errorLabel = (type: string) => {
    if (type === "Omission") return "mot omis";
    if (type === "Mispronunciation") return "mauvaise prononciation";
    if (type === "Insertion") return "mot ajouté (non attendu)";
    return type;
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20, marginTop: 16 }}>

      {/* Bannière validation */}
      <div style={{
        background: banner.bg, border: `1.5px solid ${banner.border}`,
        borderRadius: 12, padding: "12px 16px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 22 }}>{banner.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: banner.color }}>{banner.label}</span>
      </div>

      {/* Score global */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: `conic-gradient(${scoreColor(pronScore)} ${pronScore}%, #e2e8f0 0)`,
          display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: scoreColor(pronScore),
          }}>
            {Math.round(pronScore)}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>Score global</div>
          <div style={{ fontSize: 13, color: "#475569" }}>{feedback}</div>
        </div>
      </div>

      {/* Sous-scores */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Précision", value: accuracyScore },
          { label: "Fluidité", value: fluencyScore },
          { label: "Complétude", value: completenessScore },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: scoreColor(value) }}>{Math.round(value)}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Texte reconnu */}
      {recognizedText && (
        <div style={{ background: "#f0f9ff", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 13, color: "#0369a1", fontStyle: "italic" }}>
          🎙 Entendu : « {recognizedText} »
        </div>
      )}

      {/* Section corrections */}
      {errorWords.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#991b1b", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            🔧 Corrections
          </div>
          {errorWords.map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < errorWords.length - 1 ? 8 : 0, fontSize: 13 }}>
              <span style={{ fontWeight: 800, color: "#0f172a", minWidth: 90 }}>« {w.word} »</span>
              <span style={{
                background: w.errorType === "Mispronunciation" ? "#fee2e2" : "#fef9c3",
                color: w.errorType === "Mispronunciation" ? "#991b1b" : "#854d0e",
                padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700,
              }}>
                {errorLabel(w.errorType)}
              </span>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>{Math.round(w.accuracyScore)}/100</span>
            </div>
          ))}
        </div>
      )}

      {errorWords.length === 0 && words.length > 0 && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 13, color: "#166534", fontWeight: 600 }}>
          ✅ Tous les mots sont correctement prononcés !
        </div>
      )}

      {/* Détail mot par mot */}
      {words.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Détail mot par mot
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {words.map((w, i) => (
              <WordBadge key={i} word={w} color={errorColor(w.errorType)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WordBadge({ word, color }: { word: PronunciationApiResult["words"][number]; color: string }) {
  const score = Math.round(word.accuracyScore);
  return (
    <div
      title={`${word.word}: ${score}/100 — ${word.errorType}`}
      style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center",
        border: `2px solid ${color}`, borderRadius: 8, padding: "4px 10px", minWidth: 48,
        background: `${color}15`, cursor: "default",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{word.word}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{score}</span>
    </div>
  );
}

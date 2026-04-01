"use client";

import { useState } from "react";
import VocalPlayer from "@/components/vocal/VocalPlayer";
import VocalRecorder, { type PronunciationApiResult } from "@/components/vocal/VocalRecorder";
import PronunciationFeedback from "@/components/vocal/PronunciationFeedback";

// ─── Contenu pédagogique ──────────────────────────────────────────────────────

type Phrase = {
  id: string;
  niveau: "A1" | "A2";
  fr: string;
  nl: string;
  tip?: string;
};

const PHRASES: Phrase[] = [
  { id: "p1", niveau: "A1", fr: "Bonjour !", nl: "Hallo!", tip: "Le 'H' est aspiré en néerlandais." },
  { id: "p2", niveau: "A1", fr: "Je m'appelle…", nl: "Ik heet…", tip: "'ee' se prononce comme dans 'fée' mais plus long." },
  { id: "p3", niveau: "A1", fr: "J'ai 14 ans.", nl: "Ik ben veertien jaar.", tip: "'v' se prononce comme un 'f' doux." },
  { id: "p4", niveau: "A1", fr: "J'habite à Bruxelles.", nl: "Ik woon in Brussel.", tip: "'oo' est une voyelle longue, comme 'oh'." },
  { id: "p5", niveau: "A1", fr: "Comment tu t'appelles ?", nl: "Hoe heet jij?", tip: "'jij' : le 'j' se prononce comme 'y' en français." },
  { id: "p6", niveau: "A2", fr: "Je suis belge et j'aime le sport.", nl: "Ik ben Belg en ik hou van sport.", tip: "'hou van' = aimer. 'ou' se prononce 'aou'." },
  { id: "p7", niveau: "A2", fr: "Enchanté de faire ta connaissance.", nl: "Aangenaam kennis te maken.", tip: "'aa' est une voyelle très ouverte et longue." },
  { id: "p8", niveau: "A2", fr: "Je vais bien, merci !", nl: "Het gaat goed, dank je wel!", tip: "'g' néerlandais = son guttural du fond de la gorge." },
];

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VocalPage() {
  const [niveauFilter, setNiveauFilter] = useState<"A1" | "A2" | "tous">("tous");
  const [selectedPhrase, setSelectedPhrase] = useState<Phrase>(PHRASES[0]);
  const [result, setResult] = useState<PronunciationApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = niveauFilter === "tous"
    ? PHRASES
    : PHRASES.filter((p) => p.niveau === niveauFilter);

  const handleSelect = (p: Phrase) => {
    setSelectedPhrase(p);
    setResult(null);
    setError(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: "#0f172a",
        padding: "20px 24px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: GRADIENT,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>
          🎙
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>
            Module Vocal — Néerlandais
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>
            Thème : Se présenter · FWB A1–A2
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 16px", display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>

        {/* ── Liste des phrases ── */}
        <div>
          {/* Filtre niveau */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {(["tous", "A1", "A2"] as const).map((n) => (
              <button
                key={n}
                onClick={() => setNiveauFilter(n)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 8,
                  border: "none",
                  background: niveauFilter === n ? "#0A84FF" : "#e2e8f0",
                  color: niveauFilter === n ? "#fff" : "#475569",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {n}
              </button>
            ))}
          </div>

          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "12px 14px",
                marginBottom: 6,
                borderRadius: 10,
                border: selectedPhrase.id === p.id ? "2px solid #0A84FF" : "2px solid transparent",
                background: selectedPhrase.id === p.id ? "#eff6ff" : "#fff",
                cursor: "pointer",
                transition: "all 0.15s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 6px",
                  borderRadius: 4,
                  background: p.niveau === "A1" ? "#dcfce7" : "#fef3c7",
                  color: p.niveau === "A1" ? "#166534" : "#92400e",
                }}>
                  {p.niveau}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{p.nl}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{p.fr}</div>
            </button>
          ))}
        </div>

        {/* ── Panneau exercice ── */}
        <div>
          <div style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            padding: 24,
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}>
            {/* Phrase sélectionnée */}
            <div style={{
              background: "#0f172a",
              borderRadius: 12,
              padding: "20px 24px",
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
                {selectedPhrase.nl}
              </div>
              <div style={{ fontSize: 15, color: "#94a3b8" }}>
                🇫🇷 {selectedPhrase.fr}
              </div>
              {selectedPhrase.tip && (
                <div style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: "#fbbf24",
                  background: "rgba(251,191,36,0.1)",
                  borderRadius: 6,
                  padding: "6px 10px",
                }}>
                  💡 {selectedPhrase.tip}
                </div>
              )}
            </div>

            {/* Étape 1 : Écouter */}
            <div style={{ marginBottom: 20 }}>
              <StepLabel n={1} label="Écoute le modèle" />
              <VocalPlayer
                text={selectedPhrase.nl}
                langue="nl"
                label="Écouter la prononciation"
              />
            </div>

            {/* Étape 2 : Enregistrer */}
            <div style={{ marginBottom: 4 }}>
              <StepLabel n={2} label="Répète et enregistre-toi" />
              <VocalRecorder
                referenceText={selectedPhrase.nl}
                langue="nl"
                theme="se_presenter"
                niveau={selectedPhrase.niveau}
                onResult={(r) => { setResult(r); setError(null); }}
                onError={(msg) => setError(msg)}
              />
            </div>

            {error && (
              <div style={{
                marginTop: 12,
                background: "#fef2f2", borderRadius: 8,
                padding: "8px 12px", fontSize: 13, color: "#dc2626",
              }}>
                ⚠ {error}
              </div>
            )}
          </div>

          {/* Résultat */}
          {result && <PronunciationFeedback result={result} />}

          {/* Placeholder avant premier enregistrement */}
          {!result && (
            <div style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: 12,
              padding: "14px 16px",
              fontSize: 13,
              color: "#0369a1",
              textAlign: "center",
            }}>
              🎙 Écoute la prononciation, puis enregistre ta voix pour recevoir un feedback instantané.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{
        width: 24, height: 24, borderRadius: "50%",
        background: GRADIENT,
        color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 800, flexShrink: 0,
      }}>
        {n}
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{label}</span>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import VocalPlayer from "@/components/vocal/VocalPlayer";
import VocalRecorder, { type PronunciationApiResult } from "@/components/vocal/VocalRecorder";
import PronunciationFeedback from "@/components/vocal/PronunciationFeedback";

type Phrase = { id: string; theme_key: string; niveau: "A1" | "A2"; fr: string; nl: string; tip?: string };
type Theme = { key: string; label: string; icon: string };

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

export default function VocalPage() {
  const supabase = createClient();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [themeKey, setThemeKey] = useState<string>("");
  const [niveauFilter, setNiveauFilter] = useState<"A1" | "A2" | "tous">("tous");
  const [selectedPhrase, setSelectedPhrase] = useState<Phrase | null>(null);
  const [result, setResult] = useState<PronunciationApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: th }, { data: ph }] = await Promise.all([
        supabase.from("vocal_themes").select("key,label,icon").eq("active", true).order("position"),
        supabase.from("vocal_phrases").select("id,theme_key,niveau,fr,nl,tip").eq("active", true).order("position"),
      ]);
      const thList: Theme[] = th ?? [];
      const phList: Phrase[] = ph ?? [];
      setThemes(thList);
      setPhrases(phList);
      if (thList.length > 0) {
        setThemeKey(thList[0].key);
        const first = phList.find(p => p.theme_key === thList[0].key);
        if (first) setSelectedPhrase(first);
      }
      setLoading(false);
    }
    load();
  }, []);

  const theme = themes.find(t => t.key === themeKey);
  const themePhrases = phrases.filter(p => p.theme_key === themeKey);
  const filtered = niveauFilter === "tous" ? themePhrases : themePhrases.filter(p => p.niveau === niveauFilter);

  const handleTheme = (key: string) => {
    setThemeKey(key);
    const first = phrases.find(p => p.theme_key === key);
    setSelectedPhrase(first ?? null);
    setResult(null); setError(null);
  };

  const handleSelect = (p: Phrase) => { setSelectedPhrase(p); setResult(null); setError(null); };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", fontSize: 16, color: "#64748b" }}>
      Chargement…
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      {/* Sous-header */}
      <div style={{ background: "#0f172a", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 22 }}>🎙</span>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Module Vocal — Néerlandais</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>{theme ? `Thème : ${theme.label}` : ""} · FWB A1–A2</div>
          </div>
        </div>
        <a href="/vocal/admin" style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 600,
          background: "rgba(255,255,255,0.08)", padding: "5px 12px", borderRadius: 8 }}>⚙️ Admin</a>
      </div>

      {/* Sélecteur de thème */}
      <div style={{ background: "#1e293b", padding: "10px 24px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {themes.map(t => (
          <button key={t.key} onClick={() => handleTheme(t.key)} style={{
            padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600,
            background: themeKey === t.key ? GRADIENT : "rgba(255,255,255,0.08)",
            color: themeKey === t.key ? "#fff" : "#94a3b8",
            transition: "all 0.15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", gap: 20 }}>
        {/* Liste phrases */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {(["tous", "A1", "A2"] as const).map(n => (
              <button key={n} onClick={() => setNiveauFilter(n)} style={{
                flex: 1, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                background: niveauFilter === n ? "#0A84FF" : "#e2e8f0",
                color: niveauFilter === n ? "#fff" : "#64748b",
              }}>{n}</button>
            ))}
          </div>
          {filtered.map(p => (
            <div key={p.id} onClick={() => handleSelect(p)} style={{
              padding: "12px 14px", borderRadius: 12, marginBottom: 8, cursor: "pointer",
              background: selectedPhrase?.id === p.id ? "#eff6ff" : "#fff",
              border: `2px solid ${selectedPhrase?.id === p.id ? "#0A84FF" : "#e2e8f0"}`,
              transition: "all 0.15s",
            }}>
              <div style={{
                display: "inline-block", padding: "2px 7px", borderRadius: 5,
                fontSize: 11, fontWeight: 700, marginBottom: 5,
                background: p.niveau === "A1" ? "#dcfce7" : "#fef3c7",
                color: p.niveau === "A1" ? "#166534" : "#92400e",
              }}>{p.niveau}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{p.nl}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{p.fr}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 20 }}>
              Aucune phrase pour ce filtre.<br />
              <a href="/vocal/admin" style={{ color: "#0A84FF" }}>Ajouter des phrases →</a>
            </div>
          )}
        </div>

        {/* Lecteur + enregistreur */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedPhrase ? (
            <>
              <div style={{ background: "#0f172a", borderRadius: 16, padding: "20px 22px", marginBottom: 16, color: "#fff" }}>
                <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{selectedPhrase.nl}</div>
                <div style={{ fontSize: 15, color: "#94a3b8", marginBottom: selectedPhrase.tip ? 10 : 0 }}>
                  🇫🇷 {selectedPhrase.fr}
                </div>
                {selectedPhrase.tip && (
                  <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#cbd5e1" }}>
                    💡 {selectedPhrase.tip}
                  </div>
                )}
              </div>
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 12, border: "1px solid #e2e8f0" }}>
                <StepLabel n={1} label="Écoute le modèle" />
                <VocalPlayer text={selectedPhrase.nl} langue="nl" />
              </div>
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 12, border: "1px solid #e2e8f0" }}>
                <StepLabel n={2} label="Répète et enregistre-toi" />
                <VocalRecorder
                  referenceText={selectedPhrase.nl}
                  langue="nl"
                  theme={themeKey}
                  niveau={selectedPhrase.niveau}
                  onResult={r => { setResult(r); setError(null); }}
                  onError={e => setError(e)}
                />
                {error && (
                  <div style={{ marginTop: 10, padding: "8px 12px", fontSize: 13, color: "#dc2626", background: "#fef2f2", borderRadius: 8 }}>
                    ⚠ {error}
                  </div>
                )}
              </div>
              {result && <PronunciationFeedback result={result} />}
              {!result && (
                <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#0369a1", textAlign: "center" }}>
                  🎙 Écoute la prononciation, puis enregistre ta voix pour recevoir un feedback instantané.
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", color: "#94a3b8", paddingTop: 60 }}>
              Sélectionne une phrase dans la liste.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{
        width: 26, height: 26, borderRadius: "50%",
        background: n === 1 ? "#0A84FF" : "#FF3B30",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800, flexShrink: 0,
      }}>{n}</span>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
    </div>
  );
}

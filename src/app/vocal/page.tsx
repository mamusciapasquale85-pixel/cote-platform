"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import VocalPlayer from "@/components/vocal/VocalPlayer";
import VocalRecorder, { type PronunciationApiResult } from "@/components/vocal/VocalRecorder";
import PronunciationFeedback from "@/components/vocal/PronunciationFeedback";

type Phrase = { id: string; theme_key: string; niveau: "A1" | "A2"; fr: string; nl: string; tip?: string };
type Theme = { key: string; label: string; icon: string };
type Mode = "themes" | "libre" | "liste";
type ListePhase = "input" | "practice" | "summary";
type WordResult = { word: string; score: number | null; recognizedText: string };

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
const scoreColor = (s: number) => s >= 80 ? "#10b981" : s >= 60 ? "#f59e0b" : "#ef4444";

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

  // Mode libre
  const [mode, setMode] = useState<Mode>("themes");
  const [customText, setCustomText] = useState("");
  const [activeCustomText, setActiveCustomText] = useState<string | null>(null);

  // Mode liste
  const [wordInput, setWordInput] = useState("");
  const [wordList, setWordList] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [wordResults, setWordResults] = useState<WordResult[]>([]);
  const [listePhase, setListePhase] = useState<ListePhase>("input");
  const [currentWordResult, setCurrentWordResult] = useState<PronunciationApiResult | null>(null);
  const [listeError, setListeError] = useState<string | null>(null);

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

  const handleModeSwitch = (m: Mode) => {
    setMode(m);
    setResult(null); setError(null);
    if (m !== "libre") setActiveCustomText(null);
    if (m !== "liste") { setListePhase("input"); setWordList([]); setWordResults([]); }
  };

  const handlePracticeCustom = () => {
    const txt = customText.trim();
    if (!txt) return;
    setActiveCustomText(txt);
    setResult(null); setError(null);
  };

  // ── Mode liste ────────────────────────────────────────────────────────────
  const handleStartListe = () => {
    const words = wordInput
      .split(/[\n,;]+/)
      .map(w => w.trim())
      .filter(w => w.length > 0);
    if (words.length === 0) return;
    setWordList(words);
    setWordResults([]);
    setCurrentWordIndex(0);
    setCurrentWordResult(null);
    setListeError(null);
    setListePhase("practice");
  };

  const handleWordResult = (r: PronunciationApiResult) => {
    setCurrentWordResult(r);
    setListeError(null);
  };

  const handleNextWord = () => {
    // Sauvegarder le résultat du mot courant
    const word = wordList[currentWordIndex];
    setWordResults(prev => [...prev, {
      word,
      score: currentWordResult?.pronScore ?? null,
      recognizedText: currentWordResult?.recognizedText ?? "",
    }]);

    const next = currentWordIndex + 1;
    if (next >= wordList.length) {
      setListePhase("summary");
    } else {
      setCurrentWordIndex(next);
      setCurrentWordResult(null);
      setListeError(null);
    }
  };

  const handleSkipWord = () => {
    const word = wordList[currentWordIndex];
    setWordResults(prev => [...prev, { word, score: null, recognizedText: "" }]);
    const next = currentWordIndex + 1;
    if (next >= wordList.length) setListePhase("summary");
    else { setCurrentWordIndex(next); setCurrentWordResult(null); setListeError(null); }
  };

  const handleRestartListe = () => {
    setListePhase("input");
    setWordList([]);
    setWordResults([]);
    setCurrentWordIndex(0);
    setCurrentWordResult(null);
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", fontSize: 16, color: "#64748b" }}>
      Chargement…
    </div>
  );

  const currentWord = wordList[currentWordIndex] ?? "";
  const progressPct = wordList.length > 0 ? Math.round((currentWordIndex / wordList.length) * 100) : 0;

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
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              {mode === "themes" && theme ? `Thème : ${theme.label}` : mode === "libre" ? "Mode libre" : "Liste de mots"} · FWB A1–A2
            </div>
          </div>
        </div>
        <a href="/vocal/admin" style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 600, background: "rgba(255,255,255,0.08)", padding: "5px 12px", borderRadius: 8 }}>⚙️ Admin</a>
      </div>

      {/* Sélecteur de mode */}
      <div style={{ background: "#1e293b", padding: "10px 24px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, marginRight: 8 }}>
          {([
            { id: "themes", label: "📚 Thèmes" },
            { id: "libre",  label: "✏️ Mode libre" },
            { id: "liste",  label: "📋 Liste de mots" },
          ] as { id: Mode; label: string }[]).map(m => (
            <button key={m.id} onClick={() => handleModeSwitch(m.id)} style={{
              padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700,
              background: mode === m.id ? GRADIENT : "rgba(255,255,255,0.08)",
              color: mode === m.id ? "#fff" : "#94a3b8",
            }}>{m.label}</button>
          ))}
        </div>

        {mode === "themes" && themes.map(t => (
          <button key={t.key} onClick={() => handleTheme(t.key)} style={{
            padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600,
            background: themeKey === t.key ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)",
            color: themeKey === t.key ? "#fff" : "#94a3b8",
            outline: themeKey === t.key ? "1px solid rgba(255,255,255,0.3)" : "none",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", gap: 20 }}>

        {/* ═══ MODE LISTE ══════════════════════════════════════════════════════ */}
        {mode === "liste" && (
          <div style={{ flex: 1 }}>

            {/* Phase INPUT */}
            {listePhase === "input" && (
              <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                    📋 Colle ta liste de mots
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.5 }}>
                    Un mot par ligne, ou séparés par des virgules. L&apos;outil les évalue un par un.
                  </div>
                  <textarea
                    value={wordInput}
                    onChange={e => setWordInput(e.target.value)}
                    placeholder={"goedemorgen\ngoedenmiddag\ngoedenavond\nhoe gaat het\ndankjewel\nalsjeblieft"}
                    rows={10}
                    style={{
                      width: "100%", padding: "12px 14px", border: "2px solid #e2e8f0",
                      borderRadius: 10, fontSize: 15, fontFamily: "system-ui, sans-serif",
                      resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7,
                    }}
                  />
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8, marginBottom: 16 }}>
                    {wordInput.split(/[\n,;]+/).filter(w => w.trim()).length} mot(s) détecté(s)
                  </div>
                  <button
                    onClick={handleStartListe}
                    disabled={!wordInput.trim()}
                    style={{
                      width: "100%", padding: "13px", borderRadius: 12, border: "none",
                      background: wordInput.trim() ? GRADIENT : "#e2e8f0",
                      color: wordInput.trim() ? "#fff" : "#94a3b8",
                      fontSize: 15, fontWeight: 700, cursor: wordInput.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    🚀 Démarrer la pratique
                  </button>
                </div>
              </div>
            )}

            {/* Phase PRACTICE */}
            {listePhase === "practice" && (
              <div style={{ maxWidth: 640, margin: "0 auto" }}>
                {/* Barre de progression */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                      Mot {currentWordIndex + 1} / {wordList.length}
                    </span>
                    <button onClick={handleSkipWord} style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>
                      Passer →
                    </button>
                  </div>
                  <div style={{ height: 6, background: "#e2e8f0", borderRadius: 99 }}>
                    <div style={{ height: 6, width: `${progressPct}%`, background: GRADIENT, borderRadius: 99, transition: "width 0.3s" }} />
                  </div>
                  {/* Miniatures des mots */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                    {wordList.map((w, i) => {
                      const done = wordResults.find(r => r.word === w && i < currentWordIndex);
                      const isCurrent = i === currentWordIndex;
                      return (
                        <span key={i} style={{
                          padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                          background: isCurrent ? "#0A84FF" : done ? (done.score !== null && done.score >= 60 ? "#dcfce7" : "#fee2e2") : "#f1f5f9",
                          color: isCurrent ? "#fff" : done ? (done.score !== null && done.score >= 60 ? "#166534" : "#991b1b") : "#64748b",
                          border: isCurrent ? "2px solid #0A84FF" : "2px solid transparent",
                        }}>{w}</span>
                      );
                    })}
                  </div>
                </div>

                {/* Mot courant */}
                <div style={{ background: "#0f172a", borderRadius: 16, padding: "24px 28px", marginBottom: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Prononce ce mot
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>{currentWord}</div>
                </div>

                {/* Étape 1 : Écouter */}
                <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 12, border: "1px solid #e2e8f0" }}>
                  <StepLabel n={1} label="Écoute le modèle" />
                  <VocalPlayer text={currentWord} langue="nl" />
                </div>

                {/* Étape 2 : Enregistrer */}
                <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 12, border: "1px solid #e2e8f0" }}>
                  <StepLabel n={2} label="Répète et enregistre-toi" />
                  <VocalRecorder
                    referenceText={currentWord}
                    langue="nl"
                    theme="liste"
                    niveau="A1"
                    onResult={handleWordResult}
                    onError={e => setListeError(e)}
                  />
                  {listeError && (
                    <div style={{ marginTop: 10, padding: "8px 12px", fontSize: 13, color: "#dc2626", background: "#fef2f2", borderRadius: 8 }}>
                      ⚠ {listeError}
                    </div>
                  )}
                </div>

                {/* Résultat mini + bouton suivant */}
                {currentWordResult && (
                  <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", border: "1px solid #e2e8f0", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                      {/* Score circulaire */}
                      <div style={{
                        width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
                        background: `conic-gradient(${scoreColor(currentWordResult.pronScore)} ${currentWordResult.pronScore}%, #e2e8f0 0)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{
                          width: 46, height: 46, borderRadius: "50%", background: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 16, fontWeight: 800, color: scoreColor(currentWordResult.pronScore),
                        }}>
                          {Math.round(currentWordResult.pronScore)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{currentWordResult.feedback}</div>
                        {currentWordResult.recognizedText && (
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontStyle: "italic" }}>
                            Entendu : « {currentWordResult.recognizedText} »
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleNextWord}
                      style={{
                        width: "100%", padding: "12px", borderRadius: 10, border: "none",
                        background: GRADIENT, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {currentWordIndex + 1 >= wordList.length ? "🏁 Voir le résumé" : "Mot suivant →"}
                    </button>
                  </div>
                )}

                {!currentWordResult && (
                  <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#0369a1", textAlign: "center" }}>
                    🎙 Écoute le mot, puis enregistre ta prononciation.
                  </div>
                )}
              </div>
            )}

            {/* Phase SUMMARY */}
            {listePhase === "summary" && (
              <div style={{ maxWidth: 640, margin: "0 auto" }}>
                <div style={{ background: "#0f172a", borderRadius: 16, padding: "20px 24px", marginBottom: 20, color: "#fff", textAlign: "center" }}>
                  <div style={{ fontSize: 28 }}>🏁</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>Séance terminée !</div>
                  {(() => {
                    const scored = wordResults.filter(r => r.score !== null);
                    const avg = scored.length > 0 ? Math.round(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length) : null;
                    return avg !== null ? (
                      <div style={{ fontSize: 15, color: "#94a3b8", marginTop: 4 }}>
                        Score moyen : <span style={{ color: scoreColor(avg), fontWeight: 800 }}>{avg}/100</span>
                      </div>
                    ) : null;
                  })()}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {wordResults.map((r, i) => (
                    <div key={i} style={{
                      background: "#fff", borderRadius: 12, padding: "14px 18px",
                      border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 16,
                    }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                        background: r.score !== null
                          ? `conic-gradient(${scoreColor(r.score)} ${r.score}%, #e2e8f0 0)`
                          : "#f1f5f9",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%", background: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 800,
                          color: r.score !== null ? scoreColor(r.score) : "#94a3b8",
                        }}>
                          {r.score !== null ? Math.round(r.score) : "—"}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>{r.word}</div>
                        {r.recognizedText && r.recognizedText !== r.word && (
                          <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>Entendu : « {r.recognizedText} »</div>
                        )}
                        {r.score === null && <div style={{ fontSize: 12, color: "#94a3b8" }}>Passé</div>}
                      </div>
                      {r.score !== null && (
                        <div style={{
                          padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                          background: r.score >= 80 ? "#dcfce7" : r.score >= 60 ? "#fef9c3" : "#fee2e2",
                          color: r.score >= 80 ? "#166534" : r.score >= 60 ? "#92400e" : "#991b1b",
                        }}>
                          {r.score >= 80 ? "✅ Très bien" : r.score >= 60 ? "⚠️ À retravailler" : "❌ À reprendre"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => {
                      setCurrentWordIndex(0); setWordResults([]); setCurrentWordResult(null); setListePhase("practice");
                    }}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 10, border: "none",
                      background: "#0f172a", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    🔁 Recommencer la liste
                  </button>
                  <button
                    onClick={handleRestartListe}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                      background: "#fff", color: "#0f172a", fontSize: 14, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    📋 Nouvelle liste
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ MODE LIBRE ══════════════════════════════════════════════════════ */}
        {mode === "libre" && (
          <>
            <div style={{ width: 300, flexShrink: 0 }}>
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 10 }}>
                  ✏️ Ton texte à pratiquer
                </div>
                <textarea
                  value={customText}
                  onChange={e => setCustomText(e.target.value)}
                  placeholder={"Tape des mots ou une phrase en néerlandais…\n\nEx: goedemorgen\nEx: Ik heet Emma, ik ben tien jaar oud."}
                  rows={8}
                  style={{
                    width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0",
                    borderRadius: 10, fontSize: 14, fontFamily: "system-ui, sans-serif",
                    resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6,
                  }}
                />
                <button
                  onClick={handlePracticeCustom}
                  disabled={!customText.trim()}
                  style={{
                    marginTop: 10, width: "100%", padding: "11px",
                    background: customText.trim() ? GRADIENT : "#e2e8f0",
                    color: customText.trim() ? "#fff" : "#94a3b8",
                    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: customText.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  🎯 Pratiquer ce texte
                </button>
                <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                  💡 Tu peux entrer un mot isolé, une liste de mots, ou une phrase complète.
                </div>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {activeCustomText ? (
                <>
                  <div style={{ background: "#0f172a", borderRadius: 16, padding: "20px 22px", marginBottom: 16, color: "#fff" }}>
                    <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Texte à prononcer</div>
                    <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.4, wordBreak: "break-word" }}>{activeCustomText}</div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 12, border: "1px solid #e2e8f0" }}>
                    <StepLabel n={1} label="Écoute le modèle" />
                    <VocalPlayer text={activeCustomText} langue="nl" />
                  </div>
                  <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 12, border: "1px solid #e2e8f0" }}>
                    <StepLabel n={2} label="Répète et enregistre-toi" />
                    <VocalRecorder
                      referenceText={activeCustomText}
                      langue="nl"
                      theme="libre"
                      niveau="A1"
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: "#94a3b8", textAlign: "center", gap: 12 }}>
                  <span style={{ fontSize: 48 }}>✏️</span>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Saisis un texte à gauche</div>
                  <div style={{ fontSize: 13 }}>Un mot, une liste de vocabulaire ou une phrase entière.</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ MODE THÈMES ═════════════════════════════════════════════════════ */}
        {mode === "themes" && (
          <>
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
          </>
        )}
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

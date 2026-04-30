"use client";

import { useEffect, useState, use } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = { titre: string; contenu: string };

type ExerciceData = {
  id: string;
  titre: string;
  eleveNom: string;
  classeNom: string;
  deadline: string | null;
  sections: Section[];
};

type Reponse = { sectionTitre: string; reponse: string };

type SubmitResult = {
  ok: boolean;
  score: number;
  feedback: string;
};

// ─── Config visuelle ──────────────────────────────────────────────────────────

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-BE", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function daysLeft(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Détecte si une section est de type QCM (contient des lignes A. B. C. ou A) B) C)) */
function isQCMSection(contenu: string): boolean {
  return /^\s*[A-C][.)]\s+\S/m.test(contenu);
}

/** Parse les questions QCM d'une section */
type QCMQuestion = { numero: string; question: string; options: { lettre: string; texte: string }[] };

function parseQCM(contenu: string): QCMQuestion[] {
  const lines = contenu.split("\n").map((l) => l.trim()).filter(Boolean);
  const questions: QCMQuestion[] = [];
  let current: QCMQuestion | null = null;

  for (const line of lines) {
    // Nouvelle question : commence par un chiffre
    const qMatch = line.match(/^(\d+)[.):]\s+(.+)/);
    if (qMatch) {
      if (current) questions.push(current);
      current = { numero: qMatch[1], question: qMatch[2], options: [] };
      continue;
    }
    // Option A/B/C
    const optMatch = line.match(/^([A-C])[.)]\s+(.+)/);
    if (optMatch && current) {
      current.options.push({ lettre: optMatch[1], texte: optMatch[2] });
      continue;
    }
    // Ligne de contexte sans numéro → ajoute à la question courante
    if (current && line && current.options.length === 0) {
      current.question += " " + line;
    }
  }
  if (current) questions.push(current);
  return questions.filter((q) => q.options.length >= 2);
}

/** Parse les items numérotés pour les exercices à trous / autres */
type Item = { numero: string; texte: string };

function parseItems(contenu: string): Item[] {
  const lines = contenu.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: Item[] = [];
  for (const line of lines) {
    const m = line.match(/^(\d+)[.):]\s+(.+)/);
    if (m) items.push({ numero: m[1], texte: m[2] });
  }
  return items;
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function ContenuTexte({ texte }: { texte: string }) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.8, color: "#1e293b" }}>
      {texte.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 6 }} />;
        if (/^[A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ][A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ\s:–\-]{4,}$/.test(t)) {
          return <div key={i} style={{ fontWeight: 800, fontSize: 12, color: "#0A84FF", marginTop: 14, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t}</div>;
        }
        if (/^(\d+)[.):]\s+/.test(t)) {
          return <div key={i} style={{ padding: "3px 0 3px 14px", borderLeft: "3px solid #e2e8f0", marginBottom: 3, color: "#334155", fontSize: 13 }}>{t}</div>;
        }
        return <div key={i} style={{ color: "#374151", marginBottom: 1 }}>{t}</div>;
      })}
    </div>
  );
}

function QCMInput({
  section,
  reponse,
  onChange,
}: {
  section: Section;
  reponse: string;
  onChange: (val: string) => void;
}) {
  const questions = parseQCM(section.contenu);
  const selected: Record<string, string> = {};
  try {
    const parsed = JSON.parse(reponse || "{}") as Record<string, string>;
    Object.assign(selected, parsed);
  } catch { /* ignore */ }

  function handleChange(numero: string, lettre: string) {
    const updated = { ...selected, [numero]: lettre };
    onChange(JSON.stringify(updated));
  }

  if (questions.length === 0) {
    return (
      <ItemsInput
        section={section}
        reponse={reponse}
        onChange={onChange}
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {questions.map((q) => (
        <div key={q.numero} style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#334155" }}>
            <span style={{ color: "#0A84FF", fontWeight: 800 }}>{q.numero}.</span> {q.question}
          </div>
          <div style={{ display: "grid" }}>
            {q.options.map((opt) => {
              const isSelected = selected[q.numero] === opt.lettre;
              return (
                <label
                  key={opt.lettre}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    background: isSelected ? "rgba(10,132,255,0.06)" : "#fff",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    border: isSelected ? "2px solid #0A84FF" : "2px solid #cbd5e1",
                    background: isSelected ? "#0A84FF" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                  <input
                    type="radio"
                    name={`qcm-${section.titre}-${q.numero}`}
                    value={opt.lettre}
                    checked={isSelected}
                    onChange={() => handleChange(q.numero, opt.lettre)}
                    style={{ display: "none" }}
                  />
                  <span style={{ fontSize: 13, color: "#334155" }}>
                    <strong style={{ color: "#0A84FF" }}>{opt.lettre}.</strong> {opt.texte}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemsInput({
  section,
  reponse,
  onChange,
}: {
  section: Section;
  reponse: string;
  onChange: (val: string) => void;
}) {
  const items = parseItems(section.contenu);
  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(reponse || "{}") as Record<string, string>;
  } catch { /* ignore */ }

  function handleChange(numero: string, val: string) {
    const updated = { ...answers, [numero]: val };
    onChange(JSON.stringify(updated));
  }

  if (items.length === 0) {
    // Fallback: textarea libre
    return (
      <textarea
        value={reponse}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Écris tes réponses ici…"
        rows={6}
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1.5px solid #e2e8f0",
          padding: "12px",
          fontSize: 14,
          resize: "vertical",
          fontFamily: "system-ui, sans-serif",
          lineHeight: 1.7,
          boxSizing: "border-box",
          background: "#fff",
          color: "#1e293b",
        }}
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((item) => (
        <div key={item.numero} style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 13, color: "#475569", padding: "2px 0 2px 12px", borderLeft: "3px solid #e2e8f0" }}>
            <strong style={{ color: "#0A84FF" }}>{item.numero}.</strong> {item.texte}
          </div>
          <input
            type="text"
            value={answers[item.numero] ?? ""}
            onChange={(e) => handleChange(item.numero, e.target.value)}
            placeholder={`Réponse ${item.numero}…`}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              fontSize: 14,
              fontFamily: "system-ui, sans-serif",
              boxSizing: "border-box",
              background: "#fff",
              color: "#1e293b",
              outline: "none",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ExercicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [exercice, setExercice] = useState<ExerciceData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dejaFait, setDejaFait] = useState(false);

  // Réponses par section
  const [reponses, setReponses] = useState<Record<string, string>>({});

  // État soumission
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    async function loadExercice() {
      try {
        const res = await fetch(`/api/exercice/${token}`);
        if (res.status === 409) {
          setDejaFait(true);
          return;
        }
        if (!res.ok) {
          const payload = await res.json() as { error: string };
          throw new Error(payload.error || "Exercice introuvable");
        }
        const data = await res.json() as ExerciceData;
        setExercice(data);
        // Init réponses vides
        const init: Record<string, string> = {};
        for (const s of data.sections) init[s.titre] = "";
        setReponses(init);
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    }
    void loadExercice();
  }, [token]);

  async function onSubmit() {
    if (!exercice) return;
    setSubmitting(true);
    try {
      const reponsesArray: Reponse[] = exercice.sections.map((s) => ({
        sectionTitre: s.titre,
        reponse: reponses[s.titre] ?? "",
      }));

      const res = await fetch(`/api/exercice/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reponses: reponsesArray }),
      });
      const payload = await res.json() as SubmitResult & { error?: string };
      if (!res.ok) throw new Error(payload.error || "Erreur soumission");
      setResult(payload);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── États de rendu ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div style={{ color: "#64748b", fontWeight: 600 }}>Chargement de l'exercice…</div>
        </div>
      </div>
    );
  }

  if (dejaFait) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", padding: 16 }}>
        <div style={{ maxWidth: 420, width: "100%", borderRadius: 20, background: "#fff", padding: 32, textAlign: "center", boxShadow: "0 8px 32px rgba(15,23,42,0.12)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Exercice déjà complété</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>Tu as déjà soumis cet exercice. Ton professeur a reçu tes résultats.</div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", padding: 16 }}>
        <div style={{ maxWidth: 420, width: "100%", borderRadius: 20, background: "#fff", padding: 32, textAlign: "center", boxShadow: "0 8px 32px rgba(15,23,42,0.12)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#991B1B", marginBottom: 8 }}>Exercice introuvable</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>{errorMsg}</div>
        </div>
      </div>
    );
  }

  if (result) {
    const scoreColor = result.score >= 70 ? "#15803D" : result.score >= 50 ? "#92400E" : "#991B1B";
    const scoreBg = result.score >= 70 ? "rgba(34,197,94,0.08)" : result.score >= 50 ? "rgba(251,191,36,0.08)" : "rgba(239,68,68,0.08)";
    const scoreEmoji = result.score >= 70 ? "🌟" : result.score >= 50 ? "📈" : "📚";
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "24px 16px", fontFamily: "system-ui,-apple-system,sans-serif" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ borderRadius: 20, background: "#fff", overflow: "hidden", boxShadow: "0 8px 32px rgba(15,23,42,0.12)" }}>
            <div style={{ background: GRADIENT, padding: "22px 24px", color: "#fff" }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>✦ Klasbook — Résultat</div>
              {exercice && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 3 }}>{exercice.eleveNom} · {exercice.classeNom}</div>}
            </div>
            <div style={{ padding: "28px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 8 }}>{scoreEmoji}</div>
              <div style={{ fontSize: 42, fontWeight: 900, color: scoreColor }}>{Math.round(result.score)}%</div>
              <div style={{ fontSize: 14, color: scoreColor, fontWeight: 600, marginBottom: 20 }}>
                {result.score >= 70 ? "Compétence acquise !" : result.score >= 50 ? "En bonne progression" : "Continue tes efforts !"}
              </div>

              <div style={{ padding: 16, borderRadius: 14, background: scoreBg, border: `1.5px solid ${scoreColor}`, textAlign: "left", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: scoreColor, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Feedback</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
                  {result.feedback.split("\n").map((l, i) => <div key={i}>{l || <br />}</div>)}
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 12, background: "rgba(10,132,255,0.06)", border: "1px solid rgba(10,132,255,0.18)", fontSize: 13, color: "#475569" }}>
                ✅ Ton professeur a reçu tes résultats automatiquement.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!exercice) return null;

  const days = exercice.deadline ? daysLeft(exercice.deadline) : null;
  const isUrgent = days !== null && days <= 1;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      {/* Header sticky */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: GRADIENT, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>✦ Klasbook</div>
        {exercice.deadline && (
          <div style={{
            padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700,
            background: isUrgent ? "rgba(255,59,48,0.85)" : "rgba(255,255,255,0.2)",
            color: "#fff",
          }}>
            {isUrgent ? `⚠️ Dernier délai : ${formatDeadline(exercice.deadline)}` : `📅 À rendre avant le ${formatDeadline(exercice.deadline)}`}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 40px" }}>

        {/* Carte titre */}
        <div style={{ borderRadius: 18, background: "#fff", padding: "20px 22px", marginBottom: 20, boxShadow: "0 4px 16px rgba(15,23,42,0.08)" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>{exercice.titre}</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            👤 {exercice.eleveNom} · 🏫 {exercice.classeNom}
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(10,132,255,0.06)", border: "1px solid rgba(10,132,255,0.14)", fontSize: 13, color: "#475569" }}>
            📖 Réponds à chaque exercice ci-dessous, puis clique sur <strong>"Envoyer mes réponses"</strong>. Ton professeur recevra les résultats automatiquement.
          </div>
        </div>

        {/* Sections */}
        {exercice.sections.map((section, idx) => {
          const estQCM = isQCMSection(section.contenu);
          const hasItems = parseItems(section.contenu).length > 0;
          return (
            <div key={section.titre} style={{ borderRadius: 18, background: "#fff", marginBottom: 16, boxShadow: "0 4px 16px rgba(15,23,42,0.08)", overflow: "hidden" }}>
              {/* En-tête section */}
              <div style={{ padding: "14px 20px", background: idx === 0 ? "rgba(10,132,255,0.06)" : GRADIENT, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: idx === 0 ? "#0A63BF" : "#fff" }}>
                  {section.titre}
                </div>
              </div>

              <div style={{ padding: "16px 20px" }}>
                {/* Contenu de la section (texte de l'exercice) */}
                <ContenuTexte texte={section.contenu} />

                {/* Zone de réponse (seulement pour les sections d'exercice, pas l'intro) */}
                {idx > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px dashed #e2e8f0" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                      ✏️ Mes réponses
                    </div>
                    {estQCM ? (
                      <QCMInput
                        section={section}
                        reponse={reponses[section.titre] ?? ""}
                        onChange={(val) => setReponses((prev) => ({ ...prev, [section.titre]: val }))}
                      />
                    ) : hasItems ? (
                      <ItemsInput
                        section={section}
                        reponse={reponses[section.titre] ?? ""}
                        onChange={(val) => setReponses((prev) => ({ ...prev, [section.titre]: val }))}
                      />
                    ) : (
                      <textarea
                        value={reponses[section.titre] ?? ""}
                        onChange={(e) => setReponses((prev) => ({ ...prev, [section.titre]: e.target.value }))}
                        placeholder="Écris tes réponses ici…"
                        rows={5}
                        style={{
                          width: "100%", borderRadius: 12, border: "1.5px solid #e2e8f0",
                          padding: "12px", fontSize: 14, resize: "vertical",
                          fontFamily: "system-ui, sans-serif", lineHeight: 1.7,
                          boxSizing: "border-box", background: "#fff", color: "#1e293b",
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Erreur */}
        {errorMsg && (
          <div style={{ borderRadius: 12, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", padding: "12px 16px", fontSize: 13, marginBottom: 16 }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Bouton soumettre */}
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={submitting}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 14,
            border: "none",
            background: submitting ? "#94a3b8" : GRADIENT,
            color: "#fff",
            fontWeight: 900,
            fontSize: 16,
            cursor: submitting ? "wait" : "pointer",
            boxShadow: submitting ? "none" : "0 4px 20px rgba(10,132,255,0.35)",
          }}
        >
          {submitting ? "⏳ Correction en cours…" : "📤 Envoyer mes réponses"}
        </button>
        <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 10 }}>
          Tes réponses seront corrigées automatiquement et envoyées à ton professeur.
        </div>
      </div>
    </div>
  );
}

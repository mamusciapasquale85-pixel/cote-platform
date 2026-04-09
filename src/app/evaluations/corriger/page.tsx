"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Assessment = {
  id: string;
  title: string;
  date: string;
  max_points: number | null;
  answer_key: unknown;
};

type CorrectionResult = {
  fichier: string;
  eleve?: string;
  student_id?: string | null;
  score?: number;
  score_max?: number;
  pourcentage?: number;
  remediation_declenchee?: boolean;
  erreur?: string;
};

export default function CorrigerCopiesPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedId, setSelectedId] = useState(searchParams.get("assessment_id") ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CorrectionResult[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [showAnswerKeyEditor, setShowAnswerKeyEditor] = useState(false);
  const [answerKeyJson, setAnswerKeyJson] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    supabase
      .from("assessments")
      .select("id, title, date, max_points, answer_key")
      .order("date", { ascending: false })
      .then(({ data }) => setAssessments((data ?? []) as Assessment[]));
  }, [supabase]);

  const selected = assessments.find(a => a.id === selectedId);
  const hasKey = selected?.answer_key != null;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(
      f => f.type === "application/pdf" || f.type.startsWith("image/")
    );
    setFiles(prev => [...prev, ...dropped]);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const handleSaveAnswerKey = async () => {
    if (!selectedId) return;
    try {
      JSON.parse(answerKeyJson); // Valider JSON
    } catch {
      alert("JSON invalide. Vérifiez la syntaxe.");
      return;
    }
    setSavingKey(true);
    const { error } = await supabase
      .from("assessments")
      .update({ answer_key: JSON.parse(answerKeyJson) })
      .eq("id", selectedId);
    setSavingKey(false);
    if (error) { alert("Erreur: " + error.message); return; }
    setAssessments(prev => prev.map(a =>
      a.id === selectedId ? { ...a, answer_key: JSON.parse(answerKeyJson) } : a
    ));
    setShowAnswerKeyEditor(false);
  };

  const handleSubmit = async () => {
    if (!selectedId || files.length === 0) return;
    setLoading(true);
    setResults([]);
    const formData = new FormData();
    formData.append("assessment_id", selectedId);
    files.forEach(f => formData.append("files", f));
    try {
      const res = await fetch("/api/corriger-copies-scannees", { method: "POST", body: formData });
      const data = await res.json() as { success?: boolean; corrections?: CorrectionResult[]; error?: string };
      if (data.success) { setResults(data.corrections ?? []); setFiles([]); }
      else alert("Erreur : " + data.error);
    } catch { alert("Erreur de connexion"); }
    finally { setLoading(false); }
  };

  const scoreColor = (pct: number) => pct >= 70 ? "#28a745" : pct >= 50 ? "#ff9500" : "#ff3b30";

  return (
    <div style={{ padding: "32px 28px", maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button onClick={() => router.back()}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#6e6e73", padding: "4px 8px" }}>
          ←
        </button>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: "#1d1d1f", margin: 0 }}>
            Correction automatique IA
          </h1>
          <p style={{ color: "#6e6e73", fontSize: 14, margin: "4px 0 0" }}>
            Scannez les copies — l'IA les corrige et enregistre les résultats
          </p>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #e5e5ea", margin: "20px 0 28px" }} />

      {/* Sélection évaluation */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1d1d1f", marginBottom: 8 }}>
          1. Choisir l'évaluation
        </label>
        <select
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setShowAnswerKeyEditor(false); }}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10,
            border: "1.5px solid #d2d2d7", fontSize: 15, background: "white",
            color: selectedId ? "#1d1d1f" : "#6e6e73",
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            outline: "none",
          }}
        >
          <option value="">— Sélectionner une évaluation —</option>
          {assessments.map(a => (
            <option key={a.id} value={a.id}>
              {a.title} · {a.date} · {a.max_points ?? "?"}pts
              {a.answer_key ? " ✓" : " ⚠️ sans clé"}
            </option>
          ))}
        </select>
      </div>

      {/* Clé de correction */}
      {selectedId && (
        <div style={{
          marginBottom: 24, padding: "14px 18px", borderRadius: 12,
          background: hasKey ? "rgba(52,199,89,0.06)" : "rgba(255,149,0,0.08)",
          border: `1px solid ${hasKey ? "rgba(52,199,89,0.25)" : "rgba(255,149,0,0.3)"}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, color: hasKey ? "#1a7a34" : "#b36a00", fontWeight: 500 }}>
              {hasKey ? "✅ Clé de correction configurée" : "⚠️ Pas encore de clé de correction"}
            </div>
            <button
              onClick={() => {
                setShowAnswerKeyEditor(!showAnswerKeyEditor);
                if (!answerKeyJson && selected?.answer_key) {
                  setAnswerKeyJson(JSON.stringify(selected.answer_key, null, 2));
                } else if (!answerKeyJson) {
                  setAnswerKeyJson(JSON.stringify(TEMPLATE_ANSWER_KEY, null, 2));
                }
              }}
              style={{
                background: "none", border: "1px solid #d2d2d7", borderRadius: 8,
                padding: "5px 12px", fontSize: 12, cursor: "pointer", color: "#1d1d1f",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {showAnswerKeyEditor ? "Fermer" : hasKey ? "Modifier" : "Configurer"}
            </button>
          </div>

          {showAnswerKeyEditor && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12, color: "#6e6e73", marginBottom: 8, lineHeight: 1.5 }}>
                Éditez la clé de correction au format JSON. Pour les traductions (partie1), listez les réponses acceptées.
                Pour le QCM (partie2), indiquez la lettre correcte (A, B ou C).
              </p>
              <textarea
                value={answerKeyJson}
                onChange={e => setAnswerKeyJson(e.target.value)}
                rows={16}
                style={{
                  width: "100%", padding: 12, borderRadius: 8, border: "1px solid #d2d2d7",
                  fontSize: 12, fontFamily: "SF Mono, Fira Code, monospace", resize: "vertical",
                  outline: "none", color: "#1d1d1f", background: "#fafafa",
                }}
              />
              <button
                onClick={handleSaveAnswerKey}
                disabled={savingKey}
                style={{
                  marginTop: 10, padding: "9px 20px", borderRadius: 980, border: "none",
                  background: savingKey ? "#d2d2d7" : "#0A84FF", color: "white",
                  fontSize: 14, fontWeight: 600, cursor: savingKey ? "not-allowed" : "pointer",
                  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {savingKey ? "Sauvegarde..." : "Sauvegarder la clé"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Zone de dépôt */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1d1d1f", marginBottom: 8 }}>
          2. Uploader les copies scannées
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? "#0A84FF" : "#d2d2d7"}`,
            borderRadius: 14, padding: "36px 24px", textAlign: "center",
            cursor: "pointer", transition: "all 0.2s",
            background: dragOver ? "rgba(10,132,255,0.04)" : "#fafafa",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f", marginBottom: 4 }}>
            Déposez les copies ici ou cliquez pour choisir
          </div>
          <div style={{ fontSize: 13, color: "#6e6e73" }}>
            PDF ou images — plusieurs copies à la fois acceptées
          </div>
          <input ref={fileInputRef} type="file" multiple accept="application/pdf,image/*"
            onChange={handleFileChange} style={{ display: "none" }} />
        </div>
      </div>

      {/* Fichiers sélectionnés */}
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "9px 14px", background: "white", borderRadius: 8,
              border: "1px solid #e5e5ea", fontSize: 13,
            }}>
              <span>📎 {f.name} <span style={{ color: "#6e6e73" }}>({(f.size / 1024 / 1024).toFixed(1)} Mo)</span></span>
              <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#ff3b30", fontSize: 18, lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bouton corriger */}
      <button
        onClick={handleSubmit}
        disabled={!selectedId || !hasKey || files.length === 0 || loading}
        style={{
          width: "100%", padding: 14, borderRadius: 980, border: "none",
          background: (!selectedId || !hasKey || files.length === 0 || loading) ? "#d2d2d7" : "#0A84FF",
          color: "white", fontSize: 16, fontWeight: 600,
          cursor: (!selectedId || !hasKey || files.length === 0 || loading) ? "not-allowed" : "pointer",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          transition: "background 0.2s",
          marginBottom: 32,
        }}
      >
        {loading
          ? `⏳ Correction en cours... (${files.length} copie${files.length > 1 ? "s" : ""})`
          : `🤖 Corriger ${files.length > 0 ? `${files.length} copie${files.length > 1 ? "s" : ""}` : "les copies"}`}
      </button>

      {/* Résultats */}
      {results.length > 0 && (
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, color: "#1d1d1f" }}>
            Résultats ({results.filter(r => !r.erreur).length}/{results.length} corrigées)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {results.map((r, i) => (
              <div key={i} style={{
                padding: "14px 18px", borderRadius: 12, border: "1px solid",
                borderColor: r.erreur ? "rgba(255,59,48,0.25)" : "rgba(52,199,89,0.2)",
                background: r.erreur ? "rgba(255,59,48,0.04)" : "white",
              }}>
                {r.erreur ? (
                  <div style={{ color: "#ff3b30", fontSize: 13 }}>
                    ❌ <strong>{r.fichier}</strong> — {r.erreur}
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: "#1d1d1f" }}>{r.eleve}</div>
                      <div style={{ fontSize: 12, color: "#6e6e73", marginTop: 2, display: "flex", gap: 8 }}>
                        <span>{r.fichier}</span>
                        {r.remediation_declenchee && (
                          <span style={{
                            background: "rgba(255,149,0,0.1)", color: "#b36a00",
                            padding: "1px 7px", borderRadius: 980, fontWeight: 600, fontSize: 11,
                          }}>Remédiation créée</span>
                        )}
                        {r.student_id === null && (
                          <span style={{
                            background: "rgba(255,59,48,0.1)", color: "#ff3b30",
                            padding: "1px 7px", borderRadius: 980, fontWeight: 600, fontSize: 11,
                          }}>Élève non trouvé</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(r.pourcentage ?? 0) }}>
                        {r.score}/{r.score_max}
                      </div>
                      <div style={{ fontSize: 12, color: "#6e6e73" }}>{r.pourcentage?.toFixed(0)}%</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => router.push("/resultats")}
            style={{
              marginTop: 20, padding: "10px 20px", borderRadius: 980, border: "none",
              background: "#f5f5f7", color: "#1d1d1f", fontSize: 14, fontWeight: 500,
              cursor: "pointer", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            Voir tous les résultats →
          </button>
        </div>
      )}
    </div>
  );
}

// Template pour aider le prof à remplir la clé
const TEMPLATE_ANSWER_KEY = {
  partie1: {
    type: "traduction",
    reponses: {
      "1": "Ik ben moe na school",
      "2": "Ze is ziek, ze blijft thuis",
      "3": "Waarom lach je?",
      "4": "Morgen is het zaterdag",
      "5": "Hij zoekt zijn telefoon",
      "6": "We luisteren naar de leraar",
      "7": "Het is moeilijk voor mij",
      "8": "Ze heeft een kleine broer",
      "9": "Hoeveel kost dat?",
      "10": "Hij drinkt water",
      "11": "Ik weet het niet",
      "12": "De kat is zwart",
      "13": "Waar woon je?",
      "14": "We werken samen",
      "15": "Ze wacht op de bus",
      "16": "Hij is mijn beste vriend",
      "17": "Hij is blij vandaag",
      "18": "De hond is groot",
      "19": "Ik geef een cadeau",
      "20": "Alsjeblieft, help mij",
    },
    points_par_reponse: 1,
    total_points: 20,
  },
  partie2: {
    type: "qcm",
    reponses: {
      "1": "B", "2": "C", "3": "A", "4": "C", "5": "B",
      "6": "A", "7": "C", "8": "B", "9": "C", "10": "A",
      "11": "C", "12": "B", "13": "B", "14": "C", "15": "B",
      "16": "C", "17": "C", "18": "B", "19": "C", "20": "B",
    },
    points_par_reponse: 1,
    total_points: 20,
  },
};

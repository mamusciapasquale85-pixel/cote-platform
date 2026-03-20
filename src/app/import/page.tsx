"use client";
import { useState, useRef } from "react";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

const LEVELS = ["TB", "B", "S", "I", "NI"];
const LEVEL_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  TB: { bg: "rgba(48,209,88,0.12)", color: "#166534", label: "Très Bien" },
  B:  { bg: "rgba(10,132,255,0.12)", color: "#0A63BF", label: "Bien" },
  S:  { bg: "rgba(255,159,10,0.12)", color: "#B45309", label: "Satisfaisant" },
  I:  { bg: "rgba(255,59,48,0.12)", color: "#991B1B", label: "Insuffisant" },
  NI: { bg: "rgba(100,116,139,0.12)", color: "#475569", label: "Non atteint" },
};

type Resultat = {
  prenom: string;
  nom: string;
  level: string;
  value: number | null;
  note_originale: string;
};

type AnalyseResult = {
  ok: boolean;
  erreur?: string;
  evaluation?: { titre: string; date: string | null; matiere: string; classe: string | null };
  resultats?: Resultat[];
  nb_total?: number;
  nb_remediation?: number;
  avertissements?: string[];
  colonnes_detectees?: string[];
};

export default function ImportPage() {
  const [etape, setEtape] = useState<"saisie" | "analyse" | "confirmation" | "done">("saisie");
  const [contenu, setContenu] = useState("");
  const [nomFichier, setNomFichier] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseResult | null>(null);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [resultImport, setResultImport] = useState<{ importes: number; ignores: number; erreurs: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomFichier(file.name);
    const reader = new FileReader();
    reader.onload = ev => setContenu((ev.target?.result as string) ?? "");
    reader.readAsText(file, "UTF-8");
  }

  async function analyser() {
    if (!contenu.trim()) { setErreur("Colle ou charge du contenu avant d'analyser."); return; }
    setLoading(true); setErreur(null);
    try {
      const res = await fetch("/api/import/analyser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenu, nom_fichier: nomFichier }),
      });
      const data = await res.json() as AnalyseResult;
      if (!res.ok || !data.ok) {
        setErreur(data.erreur ?? "Erreur lors de l'analyse.");
        return;
      }
      setAnalyse(data);
      setResultats(data.resultats ?? []);
      setEtape("confirmation");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function confirmer() {
    if (!analyse?.evaluation || !resultats.length) return;
    setLoading(true); setErreur(null);
    try {
      const res = await fetch("/api/import/confirmer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluation: analyse.evaluation, resultats }),
      });
      const data = await res.json() as { success?: boolean; importes?: number; ignores?: number; erreurs?: string[]; error?: string };
      if (!res.ok || !data.success) { setErreur(data.error ?? "Erreur lors de l'import."); return; }
      setResultImport({ importes: data.importes ?? 0, ignores: data.ignores ?? 0, erreurs: data.erreurs ?? [] });
      setEtape("done");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setEtape("saisie"); setContenu(""); setNomFichier(""); setAnalyse(null);
    setResultats([]); setErreur(null); setResultImport(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{ borderRadius: 18, padding: "16px 22px", background: GRADIENT, color: "#fff", marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>📥 Import de résultats</div>
        <div style={{ fontSize: 13, opacity: .85, marginTop: 2 }}>
          Compatible Excel, Google Sheets, CSV, Pronote · Conversion automatique en TB/B/S/I/NI
        </div>
      </div>

      {/* ÉTAPES */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "saisie", label: "1. Données", emoji: "📋" },
          { id: "confirmation", label: "2. Vérification", emoji: "🔍" },
          { id: "done", label: "3. Importé", emoji: "✅" },
        ].map(step => {
          const isActive = etape === step.id;
          const isDone = (step.id === "saisie" && ["confirmation","done"].includes(etape)) ||
                         (step.id === "confirmation" && etape === "done");
          return (
            <div key={step.id} style={{
              flex: 1, padding: "10px", borderRadius: 12, textAlign: "center",
              background: isActive ? "#eff6ff" : isDone ? "rgba(34,197,94,0.1)" : "#f8fafc",
              border: isActive ? "2px solid #0A84FF" : isDone ? "2px solid #22c55e" : "1.5px solid #e2e8f0",
              color: isActive ? "#0A63BF" : isDone ? "#166534" : "#94a3b8",
              fontWeight: isActive || isDone ? 700 : 500, fontSize: 13,
            }}>
              {step.emoji} {step.label}
            </div>
          );
        })}
      </div>

      {erreur && (
        <div style={{ borderRadius: 12, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
          ⚠️ {erreur}
        </div>
      )}

      {/* ÉTAPE 1 : SAISIE */}
      {etape === "saisie" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ borderRadius: 16, background: "#fff", border: "1.5px solid #e2e8f0", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 12 }}>OPTION 1 — CHARGER UN FICHIER CSV</div>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFileChange}
              style={{ fontSize: 13, color: "#334155" }} />
            {nomFichier && <div style={{ fontSize: 12, color: "#22c55e", marginTop: 8, fontWeight: 600 }}>✅ {nomFichier} chargé</div>}
          </div>

          <div style={{ borderRadius: 16, background: "#fff", border: "1.5px solid #e2e8f0", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 12 }}>OPTION 2 — COLLER DEPUIS EXCEL / GOOGLE SHEETS / PRONOTE</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
              Sélectionne tes données dans Excel ou Google Sheets (Ctrl+A ou une zone), copie (Ctrl+C), puis colle ici (Ctrl+V).
            </div>
            <textarea
              value={contenu}
              onChange={e => setContenu(e.target.value)}
              placeholder={"Nom\tPrénom\tNote\nDupont\tLucie\t14/20\nMartin\tThomas\tNI\n..."}
              rows={10}
              style={{
                width: "100%", borderRadius: 10, border: "1.5px solid #e2e8f0",
                padding: "10px 12px", fontSize: 13, fontFamily: "monospace",
                resize: "vertical", outline: "none", boxSizing: "border-box",
                background: "#f8fafc", color: "#1e293b",
              }}
            />
            {contenu && (
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                {contenu.split("\n").filter(l => l.trim()).length} lignes détectées
              </div>
            )}
          </div>

          <button onClick={analyser} disabled={loading || !contenu.trim()} style={{
            padding: "14px", borderRadius: 14, border: "none",
            background: loading || !contenu.trim() ? "#e2e8f0" : GRADIENT,
            color: loading || !contenu.trim() ? "#94a3b8" : "#fff",
            fontWeight: 900, fontSize: 16, cursor: loading || !contenu.trim() ? "not-allowed" : "pointer",
            boxShadow: loading || !contenu.trim() ? "none" : "0 4px 16px rgba(10,132,255,.3)",
          }}>
            {loading ? "⏳ Analyse en cours…" : "🤖 Analyser avec l'IA"}
          </button>

          {/* Guide */}
          <div style={{ borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", padding: 16, fontSize: 13, color: "#64748b" }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: "#334155" }}>💡 Formats acceptés</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["Excel / LibreOffice", "Copie-colle directement les cellules"],
                ["Google Sheets", "Sélectionne et copie les données"],
                ["CSV", "Upload le fichier .csv"],
                ["Pronote", "Copie le tableau de résultats"],
              ].map(([src, desc]) => (
                <div key={src} style={{ padding: "8px 10px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 12 }}>{src}</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 : CONFIRMATION */}
      {etape === "confirmation" && analyse && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Infos évaluation */}
          <div style={{ borderRadius: 16, background: "#fff", border: "1.5px solid #e2e8f0", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 12 }}>ÉVALUATION DÉTECTÉE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["Titre", analyse.evaluation?.titre ?? "—"],
                ["Matière", analyse.evaluation?.matiere ?? "—"],
                ["Date", analyse.evaluation?.date ?? "Non détectée"],
                ["Classe", analyse.evaluation?.classe ?? "Non détectée"],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{label}</div>
                  <div style={{ fontWeight: 800, color: "#0f172a", marginTop: 2 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { label: "Élèves détectés", val: analyse.nb_total ?? 0, color: "#0A84FF" },
              { label: "Remédiations (I+NI)", val: analyse.nb_remediation ?? 0, color: "#FF3B30" },
              { label: "Sans remédiation", val: (analyse.nb_total ?? 0) - (analyse.nb_remediation ?? 0), color: "#22c55e" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ flex: 1, borderRadius: 12, padding: "12px 14px", background: `${color}10`, border: `1px solid ${color}25`, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color }}>{val}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color, opacity: .8 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Avertissements */}
          {(analyse.avertissements?.length ?? 0) > 0 && (
            <div style={{ borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", padding: "12px 14px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#B45309", marginBottom: 6 }}>⚠️ Avertissements</div>
              {analyse.avertissements!.map((a, i) => <div key={i} style={{ fontSize: 12, color: "#92400e" }}>• {a}</div>)}
            </div>
          )}

          {/* Tableau résultats */}
          <div style={{ borderRadius: 16, background: "#fff", border: "1.5px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 700, color: "#334155" }}>
              📋 {resultats.length} résultats à importer — Vérifie et corrige si nécessaire
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {["Prénom", "Nom", "Note originale", "Niveau FWB"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultats.map((r, i) => {
                    const lvl = LEVEL_COLORS[r.level] ?? LEVEL_COLORS["S"];
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 12px", fontSize: 13 }}>
                          <input value={r.prenom} onChange={e => {
                            const n = [...resultats]; n[i] = { ...n[i], prenom: e.target.value }; setResultats(n);
                          }} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 8px", fontSize: 12, width: "100%" }} />
                        </td>
                        <td style={{ padding: "8px 12px", fontSize: 13 }}>
                          <input value={r.nom} onChange={e => {
                            const n = [...resultats]; n[i] = { ...n[i], nom: e.target.value }; setResultats(n);
                          }} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 8px", fontSize: 12, width: "100%" }} />
                        </td>
                        <td style={{ padding: "8px 12px", fontSize: 12, color: "#64748b" }}>{r.note_originale}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <select value={r.level} onChange={e => {
                            const n = [...resultats]; n[i] = { ...n[i], level: e.target.value }; setResultats(n);
                          }} style={{
                            border: "none", borderRadius: 99, padding: "3px 10px", fontSize: 12,
                            fontWeight: 800, cursor: "pointer",
                            background: lvl.bg, color: lvl.color,
                          }}>
                            {LEVELS.map(l => <option key={l} value={l}>{l} — {LEVEL_COLORS[l]?.label}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={reset} style={{
              flex: 1, padding: "12px", borderRadius: 12, border: "1.5px solid #e2e8f0",
              background: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#64748b",
            }}>← Recommencer</button>
            <button onClick={confirmer} disabled={loading} style={{
              flex: 2, padding: "12px", borderRadius: 12, border: "none",
              background: loading ? "#94a3b8" : GRADIENT, color: "#fff",
              fontWeight: 900, fontSize: 16, cursor: loading ? "wait" : "pointer",
              boxShadow: loading ? "none" : "0 4px 16px rgba(10,132,255,.3)",
            }}>
              {loading ? "⏳ Import en cours…" : `✅ Confirmer l'import de ${resultats.length} résultats`}
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 3 : DONE */}
      {etape === "done" && resultImport && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }}>
          <div style={{ borderRadius: 20, background: "#fff", border: "1.5px solid #e2e8f0", padding: "48px 24px" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Import terminé !</div>
            <div style={{ fontSize: 15, color: "#64748b", marginTop: 8 }}>
              {resultImport.importes} résultats importés avec succès
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20 }}>
              <div style={{ padding: "12px 20px", borderRadius: 12, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#22c55e" }}>{resultImport.importes}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>Importés</div>
              </div>
              <div style={{ padding: "12px 20px", borderRadius: 12, background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.25)" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#FF3B30" }}>{resultImport.ignores}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#991B1B" }}>Ignorés</div>
              </div>
            </div>
            {resultImport.erreurs.length > 0 && (
              <div style={{ marginTop: 16, textAlign: "left", borderRadius: 10, background: "#fef2f2", border: "1px solid #fca5a5", padding: "10px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#991b1b", marginBottom: 4 }}>Élèves non trouvés :</div>
                {resultImport.erreurs.map((e, i) => <div key={i} style={{ fontSize: 12, color: "#991b1b" }}>• {e}</div>)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="/remediations" style={{
              flex: 1, padding: "12px", borderRadius: 12, border: "1.5px solid #e2e8f0",
              background: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#334155",
              textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center",
            }}>🔧 Voir les remédiations</a>
            <button onClick={reset} style={{
              flex: 1, padding: "12px", borderRadius: 12, border: "none",
              background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>📥 Nouvel import</button>
          </div>
        </div>
      )}
    </div>
  );
}

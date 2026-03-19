"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

type Exercice = {
  id: string;
  subject: string;
  type_exercice: string;
  niveau: string;
  theme: string;
  titre: string;
  contenu: string;
  created_at: string;
};

type CorrectionResult = {
  correction: string;
  error?: string;
};

// ─── Rendu Markdown simple ────────────────────────────────────────────────────

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ fontSize: 14, lineHeight: 1.8, color: "#1e293b" }}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 8 }} />;

        if (/^## /.test(t)) {
          return (
            <div key={i} style={{
              fontWeight: 800, fontSize: 15, color: "#0f172a",
              marginTop: 20, marginBottom: 6, paddingBottom: 4,
              borderBottom: "2px solid #e2e8f0",
            }}>
              {t.replace(/^## /, "")}
            </div>
          );
        }

        if (/^### /.test(t)) {
          return (
            <div key={i} style={{ fontWeight: 700, color: "#475569", marginTop: 12, marginBottom: 4 }}>
              {t.replace(/^### /, "")}
            </div>
          );
        }

        if (/^[-•]\s/.test(t)) {
          return (
            <div key={i} style={{ paddingLeft: 16, display: "flex", gap: 8, marginBottom: 3 }}>
              <span style={{ color: "#0A84FF", fontWeight: 700 }}>·</span>
              <span>{t.replace(/^[-•]\s/, "")}</span>
            </div>
          );
        }

        if (/^---/.test(t)) {
          return <hr key={i} style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "12px 0" }} />;
        }

        const html = t
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/`([^`]+)`/g, "<code style='background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:13px'>$1</code>");

        return <div key={i} dangerouslySetInnerHTML={{ __html: html }} style={{ marginBottom: 3 }} />;
      })}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ElevePage({ params }: { params: Promise<{ id: string }> }) {
  const [exercice, setExercice] = useState<Exercice | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Réponse élève
  const [prenom, setPrenom] = useState("");
  const [reponse, setReponse] = useState("");

  // Correction
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState<CorrectionResult | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { id } = await params;
      const { data, error } = await supabase
        .from("exercices")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setExercice(data as Exercice);
      }
      setLoading(false);
    }
    void load();
  }, [params, supabase]);

  async function handleCorrection() {
    if (!exercice || !reponse.trim()) return;
    setCorrecting(true);
    setCorrection(null);
    try {
      const res = await fetch("/api/corriger-copie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercice_contenu: exercice.contenu,
          reponse_eleve: reponse,
          subject: exercice.subject,
          niveau: exercice.niveau,
          type_exercice: exercice.type_exercice,
          theme: exercice.theme,
          prenom: prenom || undefined,
        }),
      });
      const data = (await res.json()) as CorrectionResult;
      setCorrection(data);
    } catch {
      setCorrection({ correction: "", error: "Erreur réseau. Réessaie." });
    } finally {
      setCorrecting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
        <div style={{ fontSize: 36 }}>⏳</div>
        <div style={{ fontWeight: 700, color: "#64748b" }}>Chargement de l&apos;exercice…</div>
      </div>
    );
  }

  if (notFound || !exercice) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16, padding: 24 }}>
        <div style={{ fontSize: 48 }}>😕</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: "#0f172a" }}>Exercice introuvable</div>
        <div style={{ color: "#64748b", fontSize: 14, textAlign: "center" }}>
          Ce lien n&apos;est plus valide ou l&apos;exercice a été supprimé.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>

      {/* Header Klasbook */}
      <div style={{
        borderRadius: 16, padding: "14px 20px", background: GRADIENT, color: "#fff",
        marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>✦ Klasbook</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>Exercice interactif</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, opacity: 0.9 }}>
          <div style={{ fontWeight: 700 }}>{exercice.titre}</div>
          <div>{exercice.niveau}</div>
        </div>
      </div>

      {/* Prenom de l'élève */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16, marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
          Ton prénom (optionnel — pour un feedback personnalisé)
          <input
            type="text"
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            placeholder="Ex : Emma"
            style={{
              display: "block", width: "100%", marginTop: 6,
              padding: "8px 12px", border: "1.5px solid #e2e8f0",
              borderRadius: 8, fontSize: 14, boxSizing: "border-box",
            }}
          />
        </label>
      </div>

      {/* Contenu de l'exercice */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 16 }}>
        <div style={{
          padding: "12px 16px", background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>📝</div>
          <div>
            <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>{exercice.titre}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Niveau {exercice.niveau} · {exercice.theme}
            </div>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <ExerciceDisplay text={exercice.contenu} />
        </div>
      </div>

      {/* Zone de réponse */}
      {!correction && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #0A84FF", padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
            ✏️ Ta réponse
          </div>
          <textarea
            value={reponse}
            onChange={e => setReponse(e.target.value)}
            placeholder="Écris tes réponses ici…&#10;&#10;Ex : 1. Amsterdam  2. ik ben  3. de man…"
            rows={10}
            style={{
              width: "100%", padding: "10px 12px",
              border: "1.5px solid #e2e8f0", borderRadius: 10,
              fontSize: 14, lineHeight: 1.7, resize: "vertical",
              fontFamily: "system-ui, sans-serif", boxSizing: "border-box",
              outline: "none",
            }}
          />
          <button
            onClick={() => void handleCorrection()}
            disabled={!reponse.trim() || correcting}
            style={{
              marginTop: 12, width: "100%", padding: "12px 0",
              borderRadius: 10, border: "none",
              background: !reponse.trim() || correcting ? "#e2e8f0" : GRADIENT,
              color: !reponse.trim() || correcting ? "#94a3b8" : "#fff",
              fontWeight: 800, fontSize: 14,
              cursor: !reponse.trim() || correcting ? "not-allowed" : "pointer",
            }}
          >
            {correcting ? "⏳ Correction en cours…" : "✨ Faire corriger par l'IA"}
          </button>
        </div>
      )}

      {/* Résultat de correction */}
      {correction && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 16 }}>
          <div style={{
            padding: "12px 16px", background: GRADIENT, color: "#fff",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>🎓 Correction IA</div>
            <button
              onClick={() => { setCorrection(null); setReponse(""); }}
              style={{
                padding: "5px 12px", borderRadius: 8,
                border: "1.5px solid rgba(255,255,255,0.5)",
                background: "transparent", color: "#fff",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              Recommencer
            </button>
          </div>

          {correction.error ? (
            <div style={{ padding: 20, color: "#991b1b" }}>⚠️ {correction.error}</div>
          ) : (
            <div style={{ padding: 20 }}>
              <MarkdownBlock text={correction.correction} />
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
        Généré avec ✦ Klasbook · La gestion de classe simplifiée
      </div>
    </div>
  );
}

// ─── Affichage exercice (sans le corrigé) ────────────────────────────────────

function ExerciceDisplay({ text }: { text: string }) {
  // On affiche tout jusqu'à "CORRIGÉ" pour ne pas spoiler
  const corrigeIdx = text.search(/\n#+\s*(CORRIGÉ|Corrigé|corrigé|CORRECTION|Correction)/);
  const displayText = corrigeIdx > 0 ? text.slice(0, corrigeIdx) + "\n\n---\n*Le corrigé est réservé au professeur.*" : text;

  return <MarkdownBlock text={displayText} />;
}

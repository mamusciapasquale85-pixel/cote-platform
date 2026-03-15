"use client";
import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

type Niveaux = { TM: number; M: number; NM: number; NI: number };
type Eleve = {
  id: string; prenom: string; nom: string;
  total_resultats: number; niveaux: Niveaux;
  score_maitrise: number | null; dernier_niveau: string | null;
  en_difficulte: boolean;
};
type ClassGroup = { id: string; name: string };

const NIVEAU_CONFIG = {
  TM: { label: "TM", bg: "#DCFCE7", text: "#166534", border: "#BBF7D0" },
  M:  { label: "M",  bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  NM: { label: "NM", bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  NI: { label: "NI", bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
};

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span style={{ fontSize: 12, color: "#9CA3AF" }}>—</span>;
  const color = score >= 75 ? "#16A34A" : score >= 50 ? "#1D4ED8" : score >= 25 ? "#C2410C" : "#B91C1C";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 3, transition: "width .4s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32 }}>{score}%</span>
    </div>
  );
}

function NiveauxBadges({ niveaux }: { niveaux: Niveaux }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {(["TM", "M", "NM", "NI"] as const).map(n => {
        if (!niveaux[n]) return null;
        const c = NIVEAU_CONFIG[n];
        return (
          <span key={n} style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
            {niveaux[n]}{n}
          </span>
        );
      })}
    </div>
  );
}

export default function ClassePage() {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [activeClass, setActiveClass] = useState<string>("");
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"tous" | "NI" | "NM" | "difficulte">("tous");
  const [search, setSearch] = useState("");

  // Auth + chargement classes
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { window.location.href = "/login"; return; }
      supabase.from("class_groups")
        .select("id, name")
        .order("name")
        .then(({ data: cls }) => {
          if (cls && cls.length > 0) {
            setClasses(cls);
            setActiveClass(cls[0].id);
          }
        });
    });
  }, []);

  const loadEleves = useCallback(async (classGroupId: string) => {
    setLoading(true); setError(null); setEleves([]);
    try {
      const res = await fetch(`/api/classe?classGroupId=${classGroupId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEleves(data.eleves ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (activeClass) loadEleves(activeClass); }, [activeClass, loadEleves]);

  const filtered = eleves.filter(e => {
    const matchSearch = search === "" ||
      `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase());
    const matchFiltre =
      filtre === "tous" ? true :
      filtre === "NI" ? e.niveaux.NI > 0 :
      filtre === "NM" ? e.niveaux.NM > 0 :
      filtre === "difficulte" ? e.en_difficulte : true;
    return matchSearch && matchFiltre;
  });

  const activeClassData = classes.find(c => c.id === activeClass);
  const nbNI = eleves.filter(e => e.niveaux.NI > 0).length;
  const nbNM = eleves.filter(e => e.niveaux.NM > 0).length;
  const avgScore = eleves.filter(e => e.score_maitrise !== null).length > 0
    ? Math.round(eleves.filter(e => e.score_maitrise !== null).reduce((s, e) => s + (e.score_maitrise ?? 0), 0) / eleves.filter(e => e.score_maitrise !== null).length)
    : null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 4px 32px" }}>

      {/* ── Sélecteur classes ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {classes.map(c => (
          <button key={c.id} onClick={() => setActiveClass(c.id)}
            style={{ padding: "8px 18px", borderRadius: 10, border: activeClass === c.id ? "2px solid #111827" : "1.5px solid #E5E7EB", background: activeClass === c.id ? "#111827" : "#FFF", color: activeClass === c.id ? "#FFF" : "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {c.name}
          </button>
        ))}
      </div>

      {/* ── Stats ── */}
      {eleves.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Élèves", value: eleves.length, color: "#111827", bg: "#F9FAFB" },
            { label: "Score moyen", value: avgScore !== null ? `${avgScore}%` : "—", color: "#1D4ED8", bg: "#EFF6FF" },
            { label: "Avec NM", value: nbNM, color: "#C2410C", bg: "#FFF7ED" },
            { label: "Avec NI 🚨", value: nbNI, color: "#B91C1C", bg: "#FEF2F2" },
          ].map(s => (
            <div key={s.label} style={{ borderRadius: 12, padding: "12px 14px", background: s.bg, border: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtres + recherche ── */}
      <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E5E7EB", marginBottom: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB" }}>
          {[
            { id: "tous" as const, label: "Tous", count: eleves.length },
            { id: "NI" as const, label: "🚨 NI", count: nbNI },
            { id: "NM" as const, label: "⚠️ NM", count: nbNM },
            { id: "difficulte" as const, label: "En difficulté", count: eleves.filter(e => e.en_difficulte).length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setFiltre(tab.id)}
              style={{ flex: 1, padding: "11px 8px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: filtre === tab.id ? 800 : 500, color: filtre === tab.id ? "#111827" : "#9CA3AF", borderBottom: filtre === tab.id ? "2px solid #111827" : "2px solid transparent" }}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <div style={{ padding: "10px 14px" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Rechercher dans ${activeClassData?.name ?? "la classe"}…`}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 9, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box", outline: "none" }} />
        </div>
      </div>

      {/* ── Erreur / Loading ── */}
      {error && <div style={{ padding: 16, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, color: "#B91C1C", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {loading && <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}><div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>Chargement…</div>}

      {/* ── Liste élèves ── */}
      {!loading && (
        <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>

          {/* Header tableau */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr", gap: 16, padding: "10px 18px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            {["Élève", "Résultats", "Score de maîtrise", "Niveaux"].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</div>
            ))}
          </div>

          {/* Lignes */}
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
              Aucun élève{filtre !== "tous" ? " dans ce filtre" : ""}
            </div>
          ) : (
            filtered.map((e, i) => (
              <Link key={e.id} href={`/eleves/${e.id}`} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr",
                  gap: 16, padding: "12px 18px", alignItems: "center",
                  background: e.niveaux.NI > 0 ? "#FFF5F5" : i % 2 === 0 ? "#FFF" : "#FAFAFA",
                  borderBottom: "1px solid #F3F4F6",
                  cursor: "pointer",
                  transition: "background .1s",
                }}>
                  {/* Nom */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                      background: e.niveaux.NI > 0 ? "#FEE2E2" : e.niveaux.NM > 0 ? "#FEF3C7" : "#EFF6FF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 800,
                      color: e.niveaux.NI > 0 ? "#B91C1C" : e.niveaux.NM > 0 ? "#92400E" : "#1D4ED8",
                    }}>
                      {e.prenom[0]}{e.nom[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{e.prenom} {e.nom}</div>
                      {e.niveaux.NI > 0 && <div style={{ fontSize: 11, color: "#B91C1C", fontWeight: 600 }}>🚨 Besoin de remédiation</div>}
                    </div>
                  </div>

                  {/* Nb résultats */}
                  <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>
                    {e.total_resultats > 0 ? `${e.total_resultats} résultat${e.total_resultats > 1 ? "s" : ""}` : <span style={{ color: "#D1D5DB" }}>Aucun</span>}
                  </div>

                  {/* Score maîtrise */}
                  <ScoreBar score={e.score_maitrise} />

                  {/* Badges niveaux */}
                  {e.total_resultats > 0
                    ? <NiveauxBadges niveaux={e.niveaux} />
                    : <span style={{ fontSize: 12, color: "#D1D5DB" }}>—</span>
                  }
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Footer */}
      {!loading && filtered.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#9CA3AF" }}>
          {filtered.length} élève{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
          {filtre !== "tous" || search ? ` sur ${eleves.length} dans ${activeClassData?.name}` : ` dans ${activeClassData?.name}`}
        </div>
      )}
    </div>
  );
}

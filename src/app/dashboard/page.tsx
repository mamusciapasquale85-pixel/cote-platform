"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateFR } from "@/lib/date";

type Stats = {
  nb_eleves: number; nb_classes: number;
  rem_actives: number; rem_terminees: number;
  nb_evals: number; nb_ni: number; taux_remediation: number;
};

type EleveNI = { id: string; prenom: string; nom: string; nb_ni: number };
type Rem = { id: string; statut: string; attendu: string | null; type_remediation: string | null; created_at: string; eleve_id: string; eleve_nom: string };
type Eval = { id: string; title: string; date: string | null; type: string | null };

type NoteRecente = { id: string; eleve_nom: string; note: string; created_at: string };

type DashboardData = {
  teacher_first_name?: string;
  stats: Stats;
  eleves_en_difficulte: EleveNI[];
  rem_recentes: Rem[];
  notes_recentes: NoteRecente[];
  evals_recentes: Eval[];
};

const card: React.CSSProperties = {
  borderRadius: 16, background: "#fff",
  border: "1px solid rgba(15,23,42,0.08)",
  boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
  padding: "20px 22px",
};

const badge: React.CSSProperties = {
  borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 800, display: "inline-block",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 15, fontWeight: 900, marginBottom: 14, display: "flex", alignItems: "center", gap: 8,
};

function StatutBadge({ statut }: { statut: string }) {
  const styles: Record<string, React.CSSProperties> = {
    Proposee: { background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#B45309" },
    "En cours": { background: "rgba(10,132,255,0.12)", border: "1px solid rgba(10,132,255,0.3)", color: "#0A63BF" },
    Terminee: { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#166534" },
  };
  const labels: Record<string, string> = { Proposee: "Proposée", "En cours": "En cours", Terminee: "Terminée" };
  return <span style={{ ...badge, ...(styles[statut] ?? styles["En cours"]) }}>{labels[statut] ?? statut}</span>;
}

function MiniGauge({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 28, cx = 34, cy = 34, circ = 2 * Math.PI * r;
  const arc = (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={68} height={68}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(15,23,42,0.07)" strokeWidth={7} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${arc} ${circ - arc}`}
          strokeDashoffset={circ / 4} strokeLinecap="round" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fontWeight={900} fill="#0F172A">{pct}%</text>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textAlign: "center" }}>{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ ...card, height: 100, background: "rgba(15,23,42,0.04)", border: "none", boxShadow: "none" }} />
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...card, borderColor: "rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.05)", color: "#991B1B" }}>
      <b>Erreur :</b> {error}
    </div>
  );

  if (!data) return null;
  const { teacher_first_name, stats, eleves_en_difficulte, rem_recentes, notes_recentes = [], evals_recentes } = data;
  const tauxNI = stats.nb_eleves > 0 ? Math.round((stats.nb_ni / stats.nb_eleves) * 100) : 0;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 18, padding: "0 4px 40px" }}>

      {/* BANNIÈRE */}
      <div style={{
        borderRadius: 18, overflow: "hidden", position: "relative",
        background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)",
        padding: "28px 28px 24px", color: "#fff",
        boxShadow: "0 8px 30px rgba(255,59,48,0.25)",
      }}>
        <div style={{ fontSize: 26, fontWeight: 900 }}>
          Bonjour{teacher_first_name ? `, ${teacher_first_name}` : ""} 👋
        </div>
        <div style={{ marginTop: 6, opacity: 0.88, fontSize: 15 }}>
          Voici un aperçu de ta classe au {new Date().toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}.
        </div>
        <div style={{ position: "absolute", right: 24, top: 16, opacity: 0.12, fontSize: 80, userSelect: "none" }}>📊</div>
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12 }}>
        {[
          { emoji: "👥", value: stats.nb_eleves, label: "Élèves", color: "#0A84FF", bg: "rgba(10,132,255,0.07)", border: "rgba(10,132,255,0.18)" },
          { emoji: "🏫", value: stats.nb_classes, label: "Classes", color: "#30D158", bg: "rgba(48,209,88,0.07)", border: "rgba(48,209,88,0.18)" },
          { emoji: "📝", value: stats.nb_evals, label: "Évaluations", color: "#FF9F0A", bg: "rgba(255,159,10,0.07)", border: "rgba(255,159,10,0.18)" },
          { emoji: "🔴", value: stats.nb_ni, label: "Résultats NI", color: "#FF3B30", bg: "rgba(255,59,48,0.07)", border: "rgba(255,59,48,0.18)" },
          { emoji: "🔧", value: stats.rem_actives, label: "Remédiations actives", color: "#636AFF", bg: "rgba(99,106,255,0.07)", border: "rgba(99,106,255,0.18)" },
          { emoji: "✅", value: stats.rem_terminees, label: "Remédiations terminées", color: "#22C55E", bg: "rgba(34,197,94,0.07)", border: "rgba(34,197,94,0.18)" },
        ].map(({ emoji, value, label, color, bg, border }) => (
          <div key={label} style={{ ...card, background: bg, border: `1px solid ${border}`, padding: "16px 18px" }}>
            <div style={{ fontSize: 22 }}>{emoji}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 4 CADRES SYMMETRIQUES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>

        {/* Cadre 1 : Aperçu */}
        <div style={{ ...card, display: "flex", flexDirection: "column", minHeight: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.45, marginBottom: 14, letterSpacing: 0.5, textTransform: "uppercase" }}>Aperçu</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flex: 1, alignItems: "center" }}>
            <MiniGauge
              pct={stats.taux_remediation}
              color={stats.taux_remediation >= 70 ? "#22C55E" : stats.taux_remediation >= 40 ? "#F59E0B" : "#EF4444"}
              label="Reméd. terminées"
            />
            <MiniGauge
              pct={100 - tauxNI}
              color={(100 - tauxNI) >= 80 ? "#22C55E" : (100 - tauxNI) >= 60 ? "#F59E0B" : "#EF4444"}
              label="Élèves sans NI"
            />
          </div>
          <Link href="/resultats" style={{ textDecoration: "none" }}>
            <div style={{ marginTop: 14, padding: "8px 0", borderRadius: 10, background: "rgba(15,23,42,0.04)", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#475569", cursor: "pointer" }}>
              Voir les résultats →
            </div>
          </Link>
        </div>

        {/* Cadre 2 : Notes à l'élève */}
        <div style={{ ...card, display: "flex", flexDirection: "column", minHeight: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.45, marginBottom: 14, letterSpacing: 0.5, textTransform: "uppercase" }}>Notes à l'élève</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 12, background: "rgba(10,132,255,0.06)", border: "1px solid rgba(10,132,255,0.18)" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0A63BF" }}>📝 Pédagogiques</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#0A84FF" }}>{notes_recentes.filter(n => !(n as any).type || (n as any).type === "pedagogique").length}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>🔴 Disciplinaires</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#EF4444" }}>{notes_recentes.filter(n => (n as any).type === "disciplinaire").length}</span>
            </div>
          </div>
          <Link href="/discipline" style={{ textDecoration: "none" }}>
            <div style={{ marginTop: 14, padding: "8px 0", borderRadius: 10, background: "rgba(10,132,255,0.07)", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#0A63BF", cursor: "pointer" }}>
              ＋ Nouvelle note →
            </div>
          </Link>
        </div>

        {/* Cadre 3 : Convocations parents */}
        <div style={{ ...card, display: "flex", flexDirection: "column", minHeight: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.45, marginBottom: 14, letterSpacing: 0.5, textTransform: "uppercase" }}>Convocations parents</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.18)" }}>
              <span style={{ fontSize: 28 }}>📨</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#5B21B6" }}>Convoquer un parent</div>
                <div style={{ fontSize: 11, color: "#7C3AED", opacity: 0.8 }}>Générer une convocation écrite</div>
              </div>
            </div>
          </div>
          <Link href="/discipline?type=convocation" style={{ textDecoration: "none" }}>
            <div style={{ marginTop: 14, padding: "8px 0", borderRadius: 10, background: "rgba(124,58,237,0.07)", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#5B21B6", cursor: "pointer" }}>
              ＋ Nouvelle convocation →
            </div>
          </Link>
        </div>

        {/* Cadre 4 : Évaluations à venir */}
        <div style={{ ...card, display: "flex", flexDirection: "column", minHeight: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.45, marginBottom: 14, letterSpacing: 0.5, textTransform: "uppercase" }}>Prochaines évaluations</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {evals_recentes.length === 0 ? (
              <div style={{ opacity: 0.5, fontSize: 13, textAlign: "center", marginTop: 16 }}>Aucune évaluation prévue</div>
            ) : (
              evals_recentes.slice(0, 3).map(ev => (
                <Link key={ev.id} href="/evaluations" style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.08)", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(15,23,42,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{ev.type ?? "—"} · {ev.date ? formatDateFR(ev.date) : "Sans date"}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link href="/evaluations" style={{ textDecoration: "none" }}>
            <div style={{ marginTop: 14, padding: "8px 0", borderRadius: 10, background: "rgba(255,159,10,0.08)", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#B45309", cursor: "pointer" }}>
              Voir toutes les évaluations →
            </div>
          </Link>
        </div>

      </div>

    </div>
  );
}

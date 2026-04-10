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
  borderRadius: 18,
  background: "#fff",
  border: "1px solid rgba(15,23,42,0.07)",
  boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
  padding: "20px 22px",
};

function RingGauge({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 26, cx = 32, cy = 32, circ = 2 * Math.PI * r;
  const arc = Math.min(pct / 100, 1) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={64} height={64}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth={6} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${arc} ${circ - arc}`}
          strokeDashoffset={circ / 4} strokeLinecap="round" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0F172A">{pct}%</text>
      </svg>
      <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textAlign: "center", lineHeight: 1.3 }}>{label}</span>
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
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ height: 90, borderRadius: 18, background: "rgba(15,23,42,0.04)", animation: "pulse 1.5s infinite" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: 88, borderRadius: 16, background: "rgba(15,23,42,0.04)", animation: "pulse 1.5s infinite" }} />
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...card, borderColor: "rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.04)", color: "#991B1B", padding: "16px 20px" }}>
      <b>Erreur :</b> {error}
    </div>
  );

  if (!data) return null;
  const { teacher_first_name, stats, notes_recentes = [], evals_recentes } = data;
  const tauxNI = stats.nb_eleves > 0 ? Math.round((stats.nb_ni / stats.nb_eleves) * 100) : 0;
  const dayName = new Date().toLocaleDateString("fr-BE", { weekday: "long" });
  const dateStr = new Date().toLocaleDateString("fr-BE", { day: "numeric", month: "long" });

  const statItems = [
    { value: stats.nb_eleves,     label: "Élèves",           accent: "#0A84FF" },
    { value: stats.nb_classes,    label: "Classes",           accent: "#30D158" },
    { value: stats.nb_evals,      label: "Évaluations",       accent: "#FF9F0A" },
    { value: stats.nb_ni,         label: "Résultats NI",      accent: "#FF3B30" },
    { value: stats.rem_actives,   label: "Reméd. actives",    accent: "#636AFF" },
    { value: stats.rem_terminees, label: "Reméd. terminées",  accent: "#22C55E" },
  ];

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 16, padding: "0 4px 48px" }}>

      {/* ── GREETING ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "4px 2px 0" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
            Bonjour{teacher_first_name ? `, ${teacher_first_name}` : ""} 👋
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, marginTop: 2, textTransform: "capitalize" }}>
            {dayName} {dateStr}
          </div>
        </div>
        <Link href="/evaluations/creer" style={{ textDecoration: "none" }}>
          <button style={{
            padding: "9px 16px", borderRadius: 12, border: "none", cursor: "pointer",
            background: "#0A84FF", color: "#fff", fontWeight: 700, fontSize: 13,
            boxShadow: "0 2px 8px rgba(10,132,255,0.35)",
          }}>
            + Évaluation
          </button>
        </Link>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {statItems.map(({ value, label, accent }) => (
          <div key={label} style={{ ...card, padding: "16px 18px 14px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: accent, letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginTop: 6, lineHeight: 1.3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── RANGÉE BAS : 4 cadres ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>

        {/* Aperçu qualité */}
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 16 }}>Aperçu</div>
          <div style={{ flex: 1, display: "flex", justifyContent: "space-evenly", alignItems: "center" }}>
            <RingGauge
              pct={stats.taux_remediation}
              color={stats.taux_remediation >= 70 ? "#30D158" : stats.taux_remediation >= 40 ? "#FF9F0A" : "#FF3B30"}
              label="Reméd. terminées"
            />
            <RingGauge
              pct={100 - tauxNI}
              color={(100 - tauxNI) >= 80 ? "#30D158" : (100 - tauxNI) >= 60 ? "#FF9F0A" : "#FF3B30"}
              label="Élèves OK"
            />
          </div>
          <Link href="/resultats" style={{ textDecoration: "none" }}>
            <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#0A84FF", paddingTop: 12, borderTop: "1px solid rgba(15,23,42,0.06)" }}>
              Voir les résultats →
            </div>
          </Link>
        </div>

        {/* Notes élèves */}
        <div style={{ ...card, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 16 }}>Notes élèves</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Pédagogiques", count: notes_recentes.filter((n: any) => !n.type || n.type === "pedagogique").length, color: "#0A84FF", bg: "rgba(10,132,255,0.06)" },
              { label: "Disciplinaires", count: notes_recentes.filter((n: any) => n.type === "disciplinaire").length, color: "#FF3B30", bg: "rgba(255,59,48,0.06)" },
            ].map(({ label, count, color, bg }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 12, background: bg }}>
                <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color }}>{count}</span>
              </div>
            ))}
          </div>
          <Link href="/discipline" style={{ textDecoration: "none" }}>
            <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#0A84FF", paddingTop: 12, borderTop: "1px solid rgba(15,23,42,0.06)" }}>
              + Nouvelle note →
            </div>
          </Link>
        </div>

        {/* Convocations */}
        <div style={{ ...card, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 16 }}>Convocations</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ padding: "14px", borderRadius: 14, background: "rgba(99,106,255,0.07)", display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 28 }}>📨</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#4F46E5" }}>Convoquer un parent</div>
                <div style={{ fontSize: 11, color: "#6366F1", opacity: 0.8, marginTop: 2 }}>Générer un document écrit</div>
              </div>
            </div>
          </div>
          <Link href="/discipline?type=convocation" style={{ textDecoration: "none" }}>
            <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#4F46E5", paddingTop: 12, borderTop: "1px solid rgba(15,23,42,0.06)" }}>
              + Nouvelle convocation →
            </div>
          </Link>
        </div>

        {/* Prochaines évals */}
        <div style={{ ...card, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 16 }}>Prochaines évals</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {evals_recentes.length === 0 ? (
              <div style={{ opacity: 0.4, fontSize: 12, textAlign: "center", marginTop: 20 }}>Aucune évaluation prévue</div>
            ) : (
              evals_recentes.slice(0, 3).map(ev => (
                <Link key={ev.id} href="/evaluations" style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.07)", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(15,23,42,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#0f172a" }}>{ev.title}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{ev.type ?? "—"} · {ev.date ? formatDateFR(ev.date) : "Sans date"}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link href="/evaluations" style={{ textDecoration: "none" }}>
            <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#FF9F0A", paddingTop: 12, borderTop: "1px solid rgba(15,23,42,0.06)" }}>
              Voir les évaluations →
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDateFR } from "@/lib/date";

type ApiStatut = "Proposee" | "En cours" | "Terminee";
type SeanceStatut = "Planifiee" | "Realisee" | "Annulee";

type EleveDashboardData = {
  eleve: { id: string; prenom: string; nom: string; classe_nom: string; classe_id: string };
  score_maitrise: number;
  lacunes: Array<{ id: string; evaluation_titre: string; attendu: string | null; date: string | null; value: number | null }>;
  remediations: Array<{ id: string; statut: ApiStatut; attendu: string | null; type_remediation: string | null; evaluation_titre: string | null; created_at: string }>;
  seances: Array<{ id: string; date_seance: string | null; duree_minutes: number | null; statut: SeanceStatut; notes: string | null; attendu: string | null }>;
  progression: Array<{ node_id: string; node_titre: string; nb_evaluations: number; nb_reussis: number; taux: number }>;
  historique: Array<{ id: string; evaluation_titre: string; date: string | null; value: number | null; level: string | null }>;
};

type Props = { eleveId: string; onClose: () => void };

function toNiceError(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") return error.message;
    if ("error_description" in error && typeof error.error_description === "string") return error.error_description;
  }
  try { return JSON.stringify(error); } catch { return String(error); }
}

function normalizeText(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function isNi(level: string | null | undefined): boolean {
  return normalizeText(level ?? "") === "ni";
}

function statusLabel(statut: ApiStatut): string {
  if (statut === "Proposee") return "Proposée";
  if (statut === "Terminee") return "Terminée";
  return "En cours";
}

function statusStyle(statut: ApiStatut): React.CSSProperties {
  if (statut === "Proposee") return { background: "rgba(255,149,0,0.14)", border: "1px solid rgba(255,149,0,0.34)", color: "#B45309" };
  if (statut === "Terminee") return { background: "rgba(52,199,89,0.14)", border: "1px solid rgba(52,199,89,0.34)", color: "#15803D" };
  return { background: "rgba(10,132,255,0.14)", border: "1px solid rgba(10,132,255,0.34)", color: "#0A63BF" };
}

function seanceStatusStyle(statut: SeanceStatut): React.CSSProperties {
  if (statut === "Realisee") return { background: "rgba(52,199,89,0.14)", border: "1px solid rgba(52,199,89,0.34)", color: "#15803D" };
  if (statut === "Annulee") return { background: "rgba(220,38,38,0.14)", border: "1px solid rgba(220,38,38,0.34)", color: "#991B1B" };
  return { background: "rgba(99,102,241,0.14)", border: "1px solid rgba(99,102,241,0.34)", color: "#4338CA" };
}

function seanceStatusLabel(statut: SeanceStatut): string {
  if (statut === "Realisee") return "Réalisée";
  if (statut === "Annulee") return "Annulée";
  return "Planifiée";
}

function levelBadge(level: string | null): React.CSSProperties {
  if (isNi(level)) return { background: "rgba(220,38,38,0.14)", color: "#991B1B", border: "1px solid rgba(220,38,38,0.34)" };
  return { background: "rgba(34,197,94,0.14)", color: "#166534", border: "1px solid rgba(34,197,94,0.34)" };
}

// Jauge circulaire SVG
function ScoreGauge({ score }: { score: number }) {
  const r = 52;
  const cx = 64;
  const cy = 64;
  const circumference = 2 * Math.PI * r;
  const arc = (score / 100) * circumference;

  const color = score < 50 ? "#EF4444" : score <= 75 ? "#F59E0B" : "#22C55E";
  const label = score < 50 ? "Insuffisant" : score <= 75 ? "En progrès" : "Maîtrisé";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={128} height={128} style={{ overflow: "visible" }}>
        {/* Fond */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth={10} />
        {/* Arc coloré */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${arc} ${circumference - arc}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        {/* Texte central */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight={900} fill="#0F172A">{score}%</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="#64748B">{label}</text>
      </svg>
    </div>
  );
}

function SkeletonSection({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", padding: 12, display: "grid", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ height: 12, borderRadius: 999, background: "rgba(255,255,255,0.25)", width: `${95 - i * 10}%` }} />
      ))}
    </div>
  );
}

const section: React.CSSProperties = {
  borderRadius: 14, border: "1px solid rgba(15,23,42,0.10)", background: "#fff", padding: 14, display: "grid", gap: 10,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", gap: 6,
};

const badge: React.CSSProperties = {
  borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 800,
};

export default function EleveDashboardDrawer({ eleveId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<EleveDashboardData | null>(null);

  const historiqueTop10 = useMemo(() => data?.historique.slice(0, 10) ?? [], [data]);
  const hasMoreHistorique = (data?.historique.length ?? 0) > 10;

  const summary = useMemo(() => {
    const total = data?.historique.length ?? 0;
    const reussies = (data?.historique ?? []).filter((row) => !isNi(row.level)).length;
    return { total, reussies };
  }, [data]);

  async function loadDashboard() {
    try {
      setLoading(true);
      setErrorMsg(null);
      const response = await fetch(`/api/eleves/${eleveId}/dashboard`, { method: "GET", cache: "no-store" });
      const payload = (await response.json()) as EleveDashboardData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Impossible de charger le tableau de bord élève.");
      setData(payload);
    } catch (error: unknown) {
      setData(null);
      setErrorMsg(toNiceError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadDashboard(); }, [eleveId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", justifyContent: "flex-end", background: "rgba(15,23,42,0.48)" }}
      onClick={onClose}
    >
      <aside
        style={{ width: "min(500px, 100vw)", height: "100vh", background: "#F1F5F9", boxShadow: "-20px 0 40px rgba(15,23,42,0.25)", display: "grid", gridTemplateRows: "auto 1fr" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <header style={{ position: "sticky", top: 0, zIndex: 1, padding: "18px 16px 16px", color: "#fff", background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)", borderBottom: "1px solid rgba(255,255,255,0.24)" }}>
          <button
            onClick={onClose} aria-label="Fermer"
            style={{ position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.12)", color: "white", fontSize: 20, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >×</button>

          {loading || !data ? (
            <div style={{ display: "grid", gap: 8, paddingRight: 48 }}>
              <div style={{ height: 22, width: "72%", borderRadius: 8, background: "rgba(255,255,255,0.28)" }} />
              <div style={{ height: 14, width: "44%", borderRadius: 8, background: "rgba(255,255,255,0.22)" }} />
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 14, paddingRight: 48 }}>
              {/* Avatar initiales */}
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.22)", border: "2px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, flexShrink: 0 }}>
                {data.eleve.prenom[0]}{data.eleve.nom[0]}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>{data.eleve.prenom} {data.eleve.nom}</div>
                <div style={{ marginTop: 4, opacity: 0.88, fontSize: 13 }}>{data.eleve.classe_nom || "Classe inconnue"} · 🎓</div>
              </div>
            </div>
          )}
        </header>

        {/* BODY */}
        <div style={{ overflowY: "auto", padding: 14, display: "grid", gap: 12 }}>
          {loading && (
            <>
              <SkeletonSection lines={3} />
              <SkeletonSection lines={4} />
              <SkeletonSection lines={4} />
              <SkeletonSection lines={4} />
              <SkeletonSection lines={5} />
            </>
          )}

          {!loading && errorMsg && (
            <section style={{ ...section, borderColor: "rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.08)", color: "#991B1B" }}>
              <strong>Erreur</strong>
              <div>{errorMsg}</div>
            </section>
          )}

          {!loading && !errorMsg && data && (
            <>
              {/* SCORE DE MAÎTRISE */}
              <section style={section}>
                <div style={sectionTitle}>📊 Score de maîtrise</div>
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                  <ScoreGauge score={data.score_maitrise} />
                  <div style={{ flex: 1, minWidth: 120, display: "grid", gap: 8 }}>
                    <div style={{ background: "rgba(15,23,42,0.04)", borderRadius: 12, padding: "10px 14px" }}>
                      <div style={{ fontSize: 11, opacity: 0.65, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Évaluations</div>
                      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{summary.total}</div>
                    </div>
                    <div style={{ background: "rgba(34,197,94,0.08)", borderRadius: 12, border: "1px solid rgba(34,197,94,0.2)", padding: "10px 14px" }}>
                      <div style={{ fontSize: 11, color: "#166534", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Réussies</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#166534", marginTop: 2 }}>{summary.reussies}</div>
                    </div>
                    <div style={{ background: "rgba(220,38,38,0.08)", borderRadius: 12, border: "1px solid rgba(220,38,38,0.2)", padding: "10px 14px" }}>
                      <div style={{ fontSize: 11, color: "#991B1B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Lacunes</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#991B1B", marginTop: 2 }}>{data.lacunes.length}</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* LACUNES */}
              <section style={section}>
                <div style={{ ...sectionTitle, justifyContent: "space-between" }}>
                  <span>🔴 Lacunes détectées</span>
                  <span style={{ ...badge, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.32)", color: "#991B1B" }}>
                    {data.lacunes.length}
                  </span>
                </div>
                {data.lacunes.length === 0 ? (
                  <div style={{ color: "#15803D", fontWeight: 700 }}>Aucune lacune détectée 🎉</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {data.lacunes.map((item) => (
                      <div key={item.id} style={{ border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, padding: "10px 12px", background: "rgba(220,38,38,0.03)" }}>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>{item.evaluation_titre}</div>
                        {item.attendu && <div style={{ opacity: 0.75, fontSize: 12, marginTop: 3 }}>Attendu : {item.attendu}</div>}
                        <div style={{ opacity: 0.65, fontSize: 12, marginTop: 2 }}>
                          {item.date ? formatDateFR(item.date) : "Date —"}
                          {item.value != null ? ` · ${item.value}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* REMÉDIATIONS */}
              <section style={section}>
                <div style={{ ...sectionTitle, justifyContent: "space-between" }}>
                  <span>🔧 Remédiations</span>
                  <span style={{ ...badge, background: "rgba(15,23,42,0.07)", border: "1px solid rgba(15,23,42,0.15)", color: "#334155" }}>
                    {data.remediations.length}
                  </span>
                </div>
                {data.remediations.length === 0 ? (
                  <div style={{ opacity: 0.65, fontSize: 13 }}>Aucune remédiation en cours</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {data.remediations.map((row) => (
                      <div key={row.id} style={{ border: "1px solid rgba(15,23,42,0.10)", borderRadius: 12, padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ ...badge, ...statusStyle(row.statut) }}>{statusLabel(row.statut)}</span>
                          <span style={{ opacity: 0.6, fontSize: 12 }}>{formatDateFR(row.created_at)}</span>
                        </div>
                        <div style={{ marginTop: 6, fontWeight: 700, fontSize: 13 }}>{row.attendu ?? "Attendu non défini"}</div>
                        <div style={{ marginTop: 3, opacity: 0.7, fontSize: 12 }}>
                          {row.type_remediation ?? "—"}{row.evaluation_titre ? ` · ${row.evaluation_titre}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* SÉANCES DE REMÉDIATION */}
              {(data.seances ?? []).length > 0 && (
                <section style={section}>
                  <div style={{ ...sectionTitle, justifyContent: "space-between" }}>
                    <span>📅 Séances de remédiation</span>
                    <span style={{ ...badge, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#4338CA" }}>
                      {data.seances.length}
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {data.seances.map((s) => (
                      <div key={s.id} style={{ border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, padding: "10px 12px", background: "rgba(99,102,241,0.03)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ ...badge, ...seanceStatusStyle(s.statut) }}>{seanceStatusLabel(s.statut)}</span>
                          <span style={{ opacity: 0.65, fontSize: 12 }}>
                            {s.date_seance ? formatDateFR(s.date_seance) : "Date —"}
                            {s.duree_minutes ? ` · ${s.duree_minutes} min` : ""}
                          </span>
                        </div>
                        {s.attendu && <div style={{ marginTop: 5, fontWeight: 700, fontSize: 13 }}>{s.attendu}</div>}
                        {s.notes && <div style={{ marginTop: 3, opacity: 0.7, fontSize: 12 }}>{s.notes}</div>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* PROGRESSION PAR COMPÉTENCE */}
              {data.progression.length > 0 && (
                <section style={section}>
                  <div style={sectionTitle}>📈 Progression par compétence</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {data.progression.map((row) => (
                      <div key={row.node_id}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 700 }}>
                          <span>{row.node_titre}</span>
                          <span style={{ color: row.taux >= 75 ? "#22C55E" : row.taux >= 50 ? "#F59E0B" : "#EF4444" }}>{row.taux.toFixed(1)}%</span>
                        </div>
                        <div style={{ marginTop: 5, height: 7, borderRadius: 999, background: "rgba(15,23,42,0.08)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(0, Math.min(100, row.taux))}%`, height: "100%", background: row.taux >= 75 ? "#22C55E" : row.taux >= 50 ? "#F59E0B" : "#EF4444", transition: "width 0.5s ease" }} />
                        </div>
                        <div style={{ marginTop: 3, opacity: 0.6, fontSize: 11 }}>{row.nb_reussis}/{row.nb_evaluations} réussies</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* HISTORIQUE */}
              <section style={section}>
                <div style={{ ...sectionTitle, justifyContent: "space-between" }}>
                  <span>📋 Historique</span>
                  {hasMoreHistorique && (
                    <Link href={`/eleves/${eleveId}`} style={{ ...badge, background: "#fff", border: "1px solid rgba(15,23,42,0.14)", color: "#0F172A", textDecoration: "none" }}>
                      Voir tout
                    </Link>
                  )}
                </div>

                {historiqueTop10.length === 0 ? (
                  <div style={{ opacity: 0.65, fontSize: 13 }}>Aucun historique disponible.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 320, fontSize: 13 }}>
                      <thead>
                        <tr style={{ opacity: 0.6 }}>
                          <th style={{ textAlign: "left", padding: "0 0 8px", fontWeight: 700 }}>Évaluation</th>
                          <th style={{ textAlign: "center", padding: "0 0 8px", fontWeight: 700 }}>Note</th>
                          <th style={{ textAlign: "center", padding: "0 0 8px", fontWeight: 700 }}>Niveau</th>
                          <th style={{ textAlign: "right", padding: "0 0 8px", fontWeight: 700 }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historiqueTop10.map((row) => (
                          <tr key={row.id}>
                            <td style={{ borderTop: "1px solid rgba(15,23,42,0.07)", padding: "7px 0", fontWeight: 600 }}>{row.evaluation_titre}</td>
                            <td style={{ borderTop: "1px solid rgba(15,23,42,0.07)", padding: "7px 0", textAlign: "center" }}>{row.value != null ? row.value : "—"}</td>
                            <td style={{ borderTop: "1px solid rgba(15,23,42,0.07)", padding: "7px 6px", textAlign: "center" }}>
                              <span style={{ ...badge, ...levelBadge(row.level) }}>{row.level ?? "—"}</span>
                            </td>
                            <td style={{ borderTop: "1px solid rgba(15,23,42,0.07)", padding: "7px 0", textAlign: "right", opacity: 0.6 }}>
                              {row.date ? formatDateFR(row.date) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Link href={`/eleves/${eleveId}`} style={{ borderRadius: 10, border: "1px solid rgba(15,23,42,0.14)", padding: "8px 14px", textDecoration: "none", color: "#0F172A", fontSize: 13, fontWeight: 800, background: "#fff" }}>
                    Ouvrir la fiche complète →
                  </Link>
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

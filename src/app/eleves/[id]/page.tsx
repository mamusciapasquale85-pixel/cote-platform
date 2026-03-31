"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatDateFR } from "@/lib/date";
import {
  type UUID,
  type TeacherContext,
  type StudentIdentity,
  type StudentClassInfo,
  type StudentResult,
  type Remarque,
  getTeacherContext,
  getStudentIdentity,
  getCurrentClassInfo,
  listStudentResults,
  listRecentRemarques,
} from "../eleves";

/* ─── helpers ─── */
function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    if ("message" in e && typeof e.message === "string") return e.message;
    if ("error_description" in e && typeof e.error_description === "string") return e.error_description;
  }
  try { return JSON.stringify(e, null, 2); } catch { return String(e); }
}

function toPercent(sumValue: number, sumMax: number): string {
  if (sumMax <= 0) return "—";
  return `${((sumValue / sumMax) * 100).toFixed(1)} %`;
}

function isNi(level: string | null | undefined): boolean {
  if (!level) return false;
  return level.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "ni";
}

function masteryColor(score: number): string {
  if (score < 50) return "#EF4444";
  if (score <= 75) return "#F59E0B";
  return "#22C55E";
}

function masteryLabel(score: number): string {
  if (score < 50) return "Insuffisant";
  if (score <= 75) return "En progrès";
  return "Maîtrisé";
}

const REMARQUE_TYPE_LABEL: Record<string, string> = {
  discipline: "Discipline", suivi: "Suivi", parent: "Parent",
  retard: "Retard", materiel: "Matériel", autre: "Autre",
};

/* ─── styles ─── */
const card: React.CSSProperties = {
  borderRadius: 16, padding: "18px 20px", background: "white",
  border: "1px solid rgba(15,23,42,0.09)", boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 17, fontWeight: 900, marginBottom: 14, display: "flex", alignItems: "center", gap: 8,
};

const statBox: React.CSSProperties = {
  borderRadius: 12, padding: "12px 16px", background: "rgba(15,23,42,0.04)",
};

const badge: React.CSSProperties = {
  borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 800, display: "inline-block",
};

const btn: React.CSSProperties = {
  padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)",
  background: "white", cursor: "pointer", fontWeight: 700, fontSize: 13,
};

const btnPrimary: React.CSSProperties = {
  ...btn, background: "rgba(10,132,255,0.08)", borderColor: "rgba(10,132,255,0.25)", color: "#0A63BF",
};

/* ─── ProgressionChart ─── */
function ProgressionChart({ results }: { results: StudentResult[] }) {
  const now = new Date();
  const yr = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const periods = [
    { id: "T1", label: "T1", sub: "Sept–Déc", from: new Date(`${yr}-09-01`), to: new Date(`${yr}-12-31`) },
    { id: "T2", label: "T2", sub: "Jan–Mars", from: new Date(`${yr + 1}-01-01`), to: new Date(`${yr + 1}-03-31`) },
    { id: "T3", label: "T3", sub: "Avr–Juin", from: new Date(`${yr + 1}-04-01`), to: new Date(`${yr + 1}-06-30`) },
  ];
  const data = periods.map((p) => {
    const inP = results.filter((r) => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return d >= p.from && d <= p.to;
    });
    const total = inP.length;
    const reussies = inP.filter((r) => !isNi(r.level)).length;
    const score = total > 0 ? Math.round((reussies / total) * 100) : null;
    return { ...p, score, total };
  });

  if (!data.some((d) => d.score !== null)) return (
    <div style={{ opacity: 0.6, fontSize: 13 }}>Pas encore assez de données par trimestre.</div>
  );

  const BAR_W = 90, GAP = 30, MAX_H = 110, SVG_W = 3 * (BAR_W + GAP) + GAP, SVG_H = MAX_H + 54;

  const validPts = data
    .map((d, i) => d.score !== null ? { x: GAP + i * (BAR_W + GAP) + BAR_W / 2, y: MAX_H - (d.score / 100) * MAX_H } : null)
    .filter(Boolean) as { x: number; y: number }[];

  return (
    <svg width={SVG_W} height={SVG_H} style={{ display: "block", maxWidth: "100%" }}>
      {/* grid lines */}
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={0} y1={MAX_H - (v / 100) * MAX_H} x2={SVG_W} y2={MAX_H - (v / 100) * MAX_H} stroke="rgba(15,23,42,0.06)" strokeWidth={1} />
          <text x={SVG_W - 2} y={MAX_H - (v / 100) * MAX_H - 3} textAnchor="end" fontSize={9} fill="#94A3B8">{v}%</text>
        </g>
      ))}
      {/* trend line */}
      {validPts.length >= 2 && (
        <path d={validPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
          stroke="#0A84FF" strokeWidth={2.5} fill="none" strokeDasharray="5 3" opacity={0.5} />
      )}
      {data.map((d, i) => {
        const x = GAP + i * (BAR_W + GAP);
        const barH = d.score !== null ? (d.score / 100) * MAX_H : 0;
        const y = MAX_H - barH;
        const color = d.score === null ? "#CBD5E1" : masteryColor(d.score);
        return (
          <g key={d.id}>
            <rect x={x} y={0} width={BAR_W} height={MAX_H} fill="rgba(15,23,42,0.03)" rx={6} />
            {d.score !== null && <rect x={x} y={y} width={BAR_W} height={barH} fill={color} rx={6} opacity={0.82} />}
            <text x={x + BAR_W / 2} y={d.score !== null ? y - 7 : MAX_H / 2 + 5} textAnchor="middle" fontSize={15} fontWeight={900} fill={d.score !== null ? color : "#94A3B8"}>
              {d.score !== null ? `${d.score}%` : "—"}
            </text>
            <text x={x + BAR_W / 2} y={MAX_H + 16} textAnchor="middle" fontSize={13} fontWeight={800} fill="#334155">{d.label}</text>
            <text x={x + BAR_W / 2} y={MAX_H + 30} textAnchor="middle" fontSize={10} fill="#94A3B8">{d.sub}</text>
            {d.total > 0 && (
              <text x={x + BAR_W / 2} y={MAX_H + 44} textAnchor="middle" fontSize={10} fill="#CBD5E1">{d.total} éval{d.total > 1 ? "s" : ""}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── ScoreGauge ─── */
function ScoreGauge({ score }: { score: number }) {
  const r = 56;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * r;
  const arc = (score / 100) * circumference;
  const color = masteryColor(score);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={140} height={140}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(15,23,42,0.07)" strokeWidth={11} />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={11}
          strokeDasharray={`${arc} ${circumference - arc}`}
          strokeDashoffset={circumference / 4} strokeLinecap="round"
        />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={26} fontWeight={900} fill="#0F172A">{score}%</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={12} fill={color} fontWeight={700}>{masteryLabel(score)}</text>
      </svg>
    </div>
  );
}

/* ─── Page ─── */
export default function ElevePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = (params?.id as string | undefined) ?? "";

  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentIdentity | null>(null);
  const [classInfo, setClassInfo] = useState<StudentClassInfo | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [hasApprentissage, setHasApprentissage] = useState<boolean>(false);
  const [remarqueRows, setRemarqueRows] = useState<Remarque[]>([]);
  const [remarquesTableMissing, setRemarquesTableMissing] = useState(false);

  const [showCommModal, setShowCommModal] = useState(false);
  const [commText, setCommText] = useState("");

  // Invitation parent
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const averages = useMemo(() => {
    const valid = results.filter((r) => r.value != null && r.max_points != null && (r.max_points ?? 0) > 0);
    let sumValue = 0, sumMax = 0;
    for (const r of valid) { sumValue += r.value ?? 0; sumMax += r.max_points ?? 0; }

    const byApp = new Map<string, { label: string; sumValue: number; sumMax: number }>();
    if (hasApprentissage) {
      for (const r of valid) {
        const key = r.apprentissage_id ?? "__none__";
        const label = r.apprentissage_name ?? "Sans apprentissage";
        const current = byApp.get(key) ?? { label, sumValue: 0, sumMax: 0 };
        current.sumValue += r.value ?? 0;
        current.sumMax += r.max_points ?? 0;
        byApp.set(key, current);
      }
    }

    const totalEvals = results.length;
    const reussies = results.filter((r) => !isNi(r.level)).length;
    const scoreMaitrise = totalEvals > 0 ? Math.round((reussies / totalEvals) * 100) : 0;
    const lacunes = results.filter((r) => isNi(r.level)).length;

    return {
      global: toPercent(sumValue, sumMax),
      byApprentissage: Array.from(byApp.values()).sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" })),
      scoreMaitrise, reussies, totalEvals, lacunes,
    };
  }, [results, hasApprentissage]);

  async function loadAll(currentCtx: TeacherContext, sid: UUID) {
    setErrorMsg(null);
    setInfoMsg(null);
    const [identity, cls, resultPayload, remarques] = await Promise.all([
      getStudentIdentity(currentCtx, sid),
      getCurrentClassInfo(currentCtx, sid),
      listStudentResults(currentCtx, sid),
      listRecentRemarques(currentCtx, sid, 5),
    ]);
    setStudent(identity);
    setClassInfo(cls);
    setResults(resultPayload.rows);
    setHasApprentissage(resultPayload.hasApprentissage);
    setRemarqueRows(remarques.rows);
    setRemarquesTableMissing(remarques.tableMissing);
  }

  useEffect(() => {
    (async () => {
      try {
        if (!studentId) throw new Error("ID élève manquant.");
        const c = await getTeacherContext();
        setCtx(c);
        await loadAll(c, studentId as UUID);
      } catch (e: unknown) { setErrorMsg(toNiceError(e)); }
    })();
  }, [studentId]);

  const initials = student
    ? `${student.first_name?.[0] ?? ""}${student.last_name?.[0] ?? ""}`.toUpperCase()
    : "?";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16, padding: "0 4px 32px" }}>

      {/* Messages */}
      {errorMsg && (
        <div style={{ ...card, borderColor: "rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.06)", color: "#991B1B" }}>
          <b>Erreur :</b> {errorMsg}
        </div>
      )}
      {infoMsg && (
        <div style={{ ...card, borderColor: "rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.06)", color: "#166534" }}>
          {infoMsg}
        </div>
      )}

      {/* ── EN-TÊTE ÉLÈVE ── */}
      <div style={{
        borderRadius: 18, overflow: "hidden",
        boxShadow: "0 4px 20px rgba(15,23,42,0.12)",
      }}>
        {/* Bandeau gradient */}
        <div style={{ background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)", padding: "24px 24px 64px" }} />

        {/* Corps identité */}
        <div style={{ background: "white", padding: "0 24px 24px", marginTop: -48 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
              {/* Avatar */}
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)",
                border: "4px solid white", boxShadow: "0 4px 12px rgba(15,23,42,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, fontWeight: 900, color: "white", flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ paddingBottom: 4 }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#0F172A" }}>
                  {student ? `${student.last_name} ${student.first_name}` : "Fiche élève"}
                </div>
                <div style={{ marginTop: 4, color: "#64748B", fontWeight: 600 }}>
                  {classInfo?.class_name ?? "—"}
                  {classInfo?.grade_level ? ` · Niveau ${classInfo.grade_level}` : ""}
                </div>
              </div>
            </div>
            <button style={btn} onClick={() => router.back()}>← Retour</button>
          </div>

          {/* Infos contact */}
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {[
              { label: "Référence", value: student?.student_ref ?? "—" },
              { label: "Email élève", value: student?.email ?? "—" },
              { label: "Tél. parent", value: student?.parent_phone ?? "—" },
              { label: "Email parent", value: student?.parent_email ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ ...statBox }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 14, wordBreak: "break-word" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SCORE DE MAÎTRISE ── */}
      <div style={card}>
        <div style={sectionTitle}>📊 Score de maîtrise global</div>
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <ScoreGauge score={averages.scoreMaitrise} />

          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <div style={{ ...statBox }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Total évals</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{averages.totalEvals}</div>
            </div>
            <div style={{ ...statBox, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Réussies</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#166534" }}>{averages.reussies}</div>
            </div>
            <div style={{ ...statBox, background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Lacunes (NI)</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#991B1B" }}>{averages.lacunes}</div>
            </div>
            <div style={{ ...statBox, background: "rgba(15,23,42,0.04)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Moy. globale</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{averages.global}</div>
            </div>
          </div>
        </div>

        {/* Moyenne par apprentissage */}
        {hasApprentissage && averages.byApprentissage.length > 0 && (
          <div style={{ marginTop: 16, borderTop: "1px solid rgba(15,23,42,0.07)", paddingTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Détail par apprentissage</div>
            <div style={{ display: "grid", gap: 8 }}>
              {averages.byApprentissage.map((row) => {
                const pct = row.sumMax > 0 ? (row.sumValue / row.sumMax) * 100 : 0;
                return (
                  <div key={row.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                      <span>{row.label}</span>
                      <span style={{ color: masteryColor(pct) }}>{toPercent(row.sumValue, row.sumMax)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "rgba(15,23,42,0.08)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: masteryColor(pct) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── PROGRESSION T1/T2/T3 ── */}
      {results.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>📈 Progression par trimestre</div>
          <ProgressionChart results={results} />
        </div>
      )}

      {/* ── RÉSULTATS ── */}
      <div style={card}>
        <div style={sectionTitle}>📋 Résultats des évaluations</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(15,23,42,0.03)" }}>
                {["Évaluation", "Date", "Note", "Niveau", ...(hasApprentissage ? ["Apprentissage"] : [])].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 800, opacity: 0.65, borderBottom: "1px solid rgba(15,23,42,0.09)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr><td style={{ padding: "16px 12px", opacity: 0.7 }} colSpan={hasApprentissage ? 5 : 4}>Aucun résultat pour cet élève.</td></tr>
              ) : (
                results.map((r) => (
                  <tr key={r.id} style={{ transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)", fontWeight: 600 }}>{r.title}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)", opacity: 0.7, whiteSpace: "nowrap" }}>
                      {r.date ? formatDateFR(r.date) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)", fontWeight: 700 }}>
                      {r.value != null && r.max_points != null ? `${r.value}/${r.max_points}` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                      {r.level ? (
                        <span style={{
                          ...badge,
                          ...(isNi(r.level)
                            ? { background: "rgba(220,38,38,0.12)", color: "#991B1B", border: "1px solid rgba(220,38,38,0.3)" }
                            : { background: "rgba(34,197,94,0.12)", color: "#166534", border: "1px solid rgba(34,197,94,0.3)" })
                        }}>
                          {r.level}
                        </span>
                      ) : "—"}
                    </td>
                    {hasApprentissage && (
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)", opacity: 0.8 }}>
                        {r.apprentissage_name ?? "—"}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── REMARQUES ── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={sectionTitle}>📝 Remarques récentes</div>
          <Link href={`/discipline?student_id=${studentId}`} style={{ ...btn, textDecoration: "none", color: "#0F172A" }}>
            Voir tout →
          </Link>
        </div>

        {remarquesTableMissing ? (
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            La table <code>remarques</code> n'est pas encore disponible. Applique la migration SQL puis recharge.
          </div>
        ) : remarqueRows.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>Aucune remarque enregistrée.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {remarqueRows.map((row) => (
              <div key={row.id} style={{ border: "1px solid rgba(15,23,42,0.09)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ ...badge, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#4338CA" }}>
                    {REMARQUE_TYPE_LABEL[row.type] ?? row.type}
                  </span>
                  <span style={{ opacity: 0.6, fontSize: 12 }}>{formatDateFR(row.created_at)}</span>
                </div>
                <div style={{ fontSize: 14 }}>{row.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── COMMUNICATION PARENTS ── */}
      <div style={card}>
        <div style={sectionTitle}>💬 Communication parents</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={btnPrimary} onClick={() => setShowCommModal(true)}>
            ✉️ Envoyer un message
          </button>
          <button
            style={{ ...btnPrimary, background: "rgba(22,163,74,0.08)", borderColor: "rgba(22,163,74,0.25)", color: "#166534" }}
            onClick={() => { setShowInviteModal(true); setInviteEmail(student?.parent_email ?? ""); setInviteMsg(null); }}
          >
            👨‍👩‍👧 Inviter un parent
          </button>
        </div>
        <div style={{ marginTop: 8, opacity: 0.65, fontSize: 12 }}>
          Invitez les parents à accéder au portail Klasbook pour suivre les résultats de leur enfant.
        </div>
      </div>

      {/* ── MODAL INVITATION PARENT ── */}
      {showInviteModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setShowInviteModal(false)}
        >
          <div
            style={{ width: "min(520px, 96vw)", background: "white", borderRadius: 18, padding: 28, boxShadow: "0 20px 60px rgba(15,23,42,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>👨‍👩‍👧 Inviter un parent</div>
            <div style={{ opacity: 0.65, fontSize: 13, marginBottom: 18 }}>
              Le parent recevra un email avec un lien pour créer son compte et accéder au portail Klasbook.
            </div>

            {student && (
              <div style={{ background: "rgba(15,23,42,0.04)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                <b>Élève :</b> {student.last_name} {student.first_name}
              </div>
            )}

            <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
              Email du parent
            </label>
            <input
              type="email"
              required
              placeholder="parent@exemple.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.2)", fontSize: 14,
                boxSizing: "border-box", outline: "none", fontFamily: "inherit",
              }}
            />

            {inviteMsg && (
              <div style={{
                marginTop: 12, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600,
                background: inviteMsg.ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
                color: inviteMsg.ok ? "#166534" : "#991B1B",
                border: `1px solid ${inviteMsg.ok ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)"}`,
              }}>
                {inviteMsg.ok ? "✅ " : "⚠️ "}{inviteMsg.text}
              </div>
            )}

            <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
              <button
                style={{
                  padding: "10px 20px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)",
                  color: "white", fontWeight: 800, fontSize: 14,
                  cursor: inviteLoading ? "not-allowed" : "pointer",
                  opacity: inviteLoading ? 0.7 : 1,
                }}
                disabled={inviteLoading}
                onClick={async () => {
                  if (!inviteEmail.trim()) return;
                  setInviteLoading(true);
                  setInviteMsg(null);
                  try {
                    const res = await fetch("/api/inviter-parent", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: inviteEmail.trim(),
                        student_id: studentId,
                        student_name: student ? `${student.first_name} ${student.last_name}` : "",
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? "Erreur");
                    setInviteMsg({ ok: true, text: data.message });
                  } catch (err: any) {
                    setInviteMsg({ ok: false, text: err.message ?? "Erreur inconnue" });
                  } finally {
                    setInviteLoading(false);
                  }
                }}
              >
                {inviteLoading ? "Envoi…" : "📨 Envoyer l'invitation"}
              </button>
              <button style={btn} onClick={() => setShowInviteModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal communication */}
      {showCommModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setShowCommModal(false)}
        >
          <div
            style={{ width: "min(640px, 96vw)", background: "white", borderRadius: 18, padding: 24, boxShadow: "0 20px 60px rgba(15,23,42,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 14 }}>Message aux parents</div>
            <div style={{ marginBottom: 10, opacity: 0.7, fontSize: 13 }}>
              Destinataire : {student?.parent_email ?? "Email parent non renseigné"}
            </div>
            <textarea
              style={{ width: "100%", minHeight: 120, resize: "vertical", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.2)", fontSize: 14, boxSizing: "border-box" }}
              placeholder="Rédigez votre message..."
              value={commText}
              onChange={(e) => setCommText(e.target.value)}
            />
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <button style={btnPrimary} onClick={() => { setShowCommModal(false); setCommText(""); setInfoMsg("TODO : brancher la table messages."); }}>
                Enregistrer (TODO)
              </button>
              <button style={btn} onClick={() => setShowCommModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

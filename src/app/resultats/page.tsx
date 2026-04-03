"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getTeacherContext,
  listClassGroups,
  listStudentsInClass,
  listAssessmentsFull,
  listResultatsForClassFull,
  listResultatsForStudentFull,
  listApprentissages,
  type TeacherContext,
  type ClassGroup,
  type Student,
  type AssessmentFull,
  type ResultatFull,
  type Apprentissage,
} from "./resultats";

// ─── Constantes de style ──────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  sommative:   { label: "Sommative",   color: "#fff",    bg: "#dc2626" },
  formative:   { label: "Formative",   color: "#fff",    bg: "#ea580c" },
  attitude:    { label: "Attitude",    color: "#fff",    bg: "#2563eb" },
  regularite:  { label: "Régularité",  color: "#fff",    bg: "#16a34a" },
  comportement:{ label: "Comportement",color: "#fff",    bg: "#7c3aed" },
};

const LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
  NI: { label: "NI", color: "#fff", bg: "#dc2626" },
  I:  { label: "I",  color: "#fff", bg: "#ea580c" },
  S:  { label: "S",  color: "#fff", bg: "#2563eb" },
  B:  { label: "B",  color: "#fff", bg: "#16a34a" },
  TB: { label: "TB", color: "#fff", bg: "#15803d" },
};

type Tab = "classe" | "eleve" | "evaluation" | "apprentissage";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(value: number, max: number): string {
  const pct = max > 0 ? (value / max) * 100 : 0;
  if (pct >= 70) return "#16a34a";
  if (pct >= 50) return "#ea580c";
  return "#dc2626";
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const meta = TYPE_META[type.toLowerCase()] ?? { label: type, color: "#334155", bg: "#e2e8f0" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
      color: meta.color, background: meta.bg,
    }}>{meta.label}</span>
  );
}

function LevelBadge({ level }: { level: string | null }) {
  if (!level) return <span style={{ color: "#94a3b8", fontSize: 13 }}>—</span>;
  const meta = LEVEL_META[level] ?? { label: level, color: "#334155", bg: "#e2e8f0" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 99,
      fontSize: 12, fontWeight: 800,
      color: meta.color, background: meta.bg,
    }}>{meta.label}</span>
  );
}

function ScoreCell({ value, max }: { value: number | null; max: number | null }) {
  if (value === null) return <span style={{ color: "#94a3b8", fontSize: 13 }}>—</span>;
  const color = max ? scoreColor(value, max) : "#334155";
  return (
    <span style={{ fontWeight: 700, color, fontSize: 13 }}>
      {value}{max ? `/${max}` : ""}
    </span>
  );
}

function ResultCell({ r, a }: { r: ResultatFull | undefined; a: AssessmentFull }) {
  if (!r) return <td style={tdStyle}>—</td>;
  if (a.cotation_type === "nisbttb" || r.level) {
    return <td style={tdStyle}><LevelBadge level={r.level} /></td>;
  }
  return <td style={tdStyle}><ScoreCell value={r.value} max={a.max_points} /></td>;
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
      <div style={{ fontSize: 14 }}>{msg}</div>
    </div>
  );
}

// ─── Styles communs ───────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)",
  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
};

const thStyle: React.CSSProperties = {
  padding: "8px 12px", textAlign: "left", fontSize: 12, fontWeight: 700,
  color: "#64748b", background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px", fontSize: 13, color: "#334155",
  borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap",
};

const selectStyle: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
  fontSize: 13, color: "#334155", background: "#fff",
  outline: "none", cursor: "pointer", minWidth: 160,
};

// ─── VUE PAR CLASSE ───────────────────────────────────────────────────────────

function VueClasse({ ctx, classes }: { ctx: TeacherContext; classes: ClassGroup[] }) {
  const [classId, setClassId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<AssessmentFull[]>([]);
  const [resultats, setResultats] = useState<ResultatFull[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) { setStudents([]); setAssessments([]); setResultats([]); return; }
    setLoading(true); setError(null);
    listResultatsForClassFull(ctx, classId)
      .then(({ students, assessments, resultats }) => {
        setStudents(students); setAssessments(assessments); setResultats(resultats);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [classId]);

  // Index résultats par student_id → assessment_id
  const byStudentAssessment = new Map<string, ResultatFull>();
  for (const r of resultats) {
    byStudentAssessment.set(`${r.student_id}|${r.assessment_id}`, r);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <select value={classId} onChange={e => setClassId(e.target.value)} style={selectStyle}>
          <option value="">Choisir une classe…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <div style={{ color: "#dc2626", marginBottom: 12 }}>{error}</div>}
      {loading && <div style={{ color: "#64748b" }}>Chargement…</div>}

      {!loading && classId && students.length === 0 && <EmptyState msg="Aucun élève dans cette classe." />}
      {!loading && classId && students.length > 0 && assessments.length === 0 && <EmptyState msg="Aucune évaluation pour cette classe." />}

      {!loading && students.length > 0 && assessments.length > 0 && (
        <div style={{ ...cardStyle, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, position: "sticky", left: 0, background: "#f8fafc", zIndex: 1 }}>Élève</th>
                {assessments.map(a => (
                  <th key={a.id} style={thStyle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                      <span>{a.title}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <TypeBadge type={a.type} />
                        {a.date && <span style={{ fontSize: 10, color: "#94a3b8" }}>{a.date}</span>}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td style={{ ...tdStyle, position: "sticky", left: 0, background: "#fff", fontWeight: 600 }}>
                    {s.last_name} {s.first_name}
                  </td>
                  {assessments.map(a => {
                    const r = byStudentAssessment.get(`${s.id}|${a.id}`);
                    return <ResultCell key={a.id} r={r} a={a} />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── VUE PAR ÉLÈVE ────────────────────────────────────────────────────────────

function VueEleve({ ctx, classes }: { ctx: TeacherContext; classes: ClassGroup[] }) {
  const [classId, setClassId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<AssessmentFull[]>([]);
  const [resultats, setResultats] = useState<ResultatFull[]>([]);

  useEffect(() => {
    if (!classId) { setStudents([]); setStudentId(""); return; }
    listStudentsInClass(ctx, classId).then(setStudents).catch(console.error);
  }, [classId]);

  useEffect(() => {
    if (!studentId) { setAssessments([]); setResultats([]); return; }
    setLoading(true); setError(null);
    listResultatsForStudentFull(ctx, studentId)
      .then(({ resultats, assessments }) => {
        setResultats(resultats); setAssessments(assessments);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  const assessmentMap = new Map(assessments.map(a => [a.id, a]));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <select value={classId} onChange={e => { setClassId(e.target.value); setStudentId(""); }} style={selectStyle}>
          <option value="">Choisir une classe…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {students.length > 0 && (
          <select value={studentId} onChange={e => setStudentId(e.target.value)} style={selectStyle}>
            <option value="">Choisir un élève…</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>)}
          </select>
        )}
      </div>

      {error && <div style={{ color: "#dc2626", marginBottom: 12 }}>{error}</div>}
      {loading && <div style={{ color: "#64748b" }}>Chargement…</div>}
      {!loading && studentId && resultats.length === 0 && <EmptyState msg="Aucun résultat pour cet élève." />}

      {!loading && resultats.length > 0 && (
        <div style={{ ...cardStyle, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Évaluation</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Cote</th>
                <th style={thStyle}>Sous-cotes</th>
              </tr>
            </thead>
            <tbody>
              {resultats.map(r => {
                const a = assessmentMap.get(r.assessment_id);
                const subKeys = r.competency_scores ? Object.keys(r.competency_scores) : [];
                return (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{a?.title ?? "—"}</td>
                    <td style={tdStyle}><TypeBadge type={a?.type ?? null} /></td>
                    <td style={tdStyle}>{a?.date ?? "—"}</td>
                    <td style={tdStyle}>
                      {r.level
                        ? <LevelBadge level={r.level} />
                        : <ScoreCell value={r.value} max={a?.max_points ?? null} />}
                    </td>
                    <td style={tdStyle}>
                      {subKeys.length > 0 ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {subKeys.map(k => (
                            <span key={k} style={{
                              display: "inline-flex", alignItems: "center", gap: 3,
                              padding: "2px 7px", borderRadius: 99,
                              background: "#f1f5f9", fontSize: 11, color: "#334155",
                            }}>
                              <span style={{ fontWeight: 600 }}>{k}</span>
                              <span style={{ color: "#64748b" }}>{String(r.competency_scores![k])}</span>
                            </span>
                          ))}
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── VUE PAR ÉVALUATION ───────────────────────────────────────────────────────

function VueEvaluation({ ctx, classes }: { ctx: TeacherContext; classes: ClassGroup[] }) {
  const [classId, setClassId] = useState<string>("");
  const [assessments, setAssessments] = useState<AssessmentFull[]>([]);
  const [assessmentId, setAssessmentId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [resultats, setResultats] = useState<ResultatFull[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) { setAssessments([]); setAssessmentId(""); setStudents([]); setResultats([]); return; }
    Promise.all([
      listAssessmentsFull(ctx, classId),
      listStudentsInClass(ctx, classId),
    ]).then(([a, s]) => { setAssessments(a); setStudents(s); })
      .catch(console.error);
  }, [classId]);

  useEffect(() => {
    if (!assessmentId) { setResultats([]); return; }
    setLoading(true); setError(null);
    // import dynamically to avoid circular
    import("./resultats").then(mod =>
      mod.listResultatsForAssessmentFull(ctx, assessmentId)
    ).then(setResultats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [assessmentId]);

  const currentAssessment = assessments.find(a => a.id === assessmentId);
  const studentMap = new Map(students.map(s => [s.id, s]));
  const resultatMap = new Map(resultats.map(r => [r.student_id, r]));

  // Toutes les clés de sous-cotes présentes
  const subKeys = Array.from(
    new Set(resultats.flatMap(r => r.competency_scores ? Object.keys(r.competency_scores) : []))
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <select value={classId} onChange={e => { setClassId(e.target.value); setAssessmentId(""); }} style={selectStyle}>
          <option value="">Choisir une classe…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {assessments.length > 0 && (
          <select value={assessmentId} onChange={e => setAssessmentId(e.target.value)} style={selectStyle}>
            <option value="">Choisir une évaluation…</option>
            {assessments.map(a => (
              <option key={a.id} value={a.id}>{a.title} {a.date ? `(${a.date})` : ""}</option>
            ))}
          </select>
        )}
      </div>

      {currentAssessment && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{currentAssessment.title}</span>
          <TypeBadge type={currentAssessment.type} />
          {currentAssessment.max_points && (
            <span style={{ fontSize: 13, color: "#64748b" }}>/{currentAssessment.max_points} pts</span>
          )}
          {currentAssessment.date && (
            <span style={{ fontSize: 13, color: "#94a3b8" }}>{currentAssessment.date}</span>
          )}
        </div>
      )}

      {error && <div style={{ color: "#dc2626", marginBottom: 12 }}>{error}</div>}
      {loading && <div style={{ color: "#64748b" }}>Chargement…</div>}
      {!loading && assessmentId && students.length === 0 && <EmptyState msg="Aucun élève dans cette classe." />}
      {!loading && assessmentId && students.length > 0 && resultats.length === 0 && (
        <EmptyState msg="Aucun résultat encodé pour cette évaluation." />
      )}

      {!loading && assessmentId && students.length > 0 && resultats.length > 0 && (
        <div style={{ ...cardStyle, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Élève</th>
                <th style={thStyle}>Cote globale</th>
                {subKeys.map(k => <th key={k} style={thStyle}>{k}</th>)}
                <th style={thStyle}>Remédiation ?</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const r = resultatMap.get(s.id);
                const needsRemediation = r && (
                  (r.value !== null && currentAssessment?.max_points && (r.value / currentAssessment.max_points) < 0.5) ||
                  (r.level === "NI" || r.level === "I")
                );
                return (
                  <tr key={s.id} style={{ background: needsRemediation ? "rgba(220,38,38,0.04)" : undefined }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{s.last_name} {s.first_name}</td>
                    <td style={tdStyle}>
                      {r ? (
                        r.level
                          ? <LevelBadge level={r.level} />
                          : <ScoreCell value={r.value} max={currentAssessment?.max_points ?? null} />
                      ) : "—"}
                    </td>
                    {subKeys.map(k => (
                      <td key={k} style={tdStyle}>
                        {r?.competency_scores?.[k] !== undefined
                          ? <span style={{ fontWeight: 600, color: "#334155" }}>{String(r.competency_scores![k])}</span>
                          : "—"}
                      </td>
                    ))}
                    <td style={tdStyle}>
                      {needsRemediation
                        ? <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 12 }}>⚠ Oui</span>
                        : <span style={{ color: "#16a34a", fontSize: 12 }}>✓</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── VUE PAR APPRENTISSAGE ────────────────────────────────────────────────────

function VueApprentissage({ ctx, classes, apprentissages }: {
  ctx: TeacherContext;
  classes: ClassGroup[];
  apprentissages: Apprentissage[];
}) {
  const [classId, setClassId] = useState<string>("");
  const [apprentissageId, setApprentissageId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<AssessmentFull[]>([]);
  const [resultats, setResultats] = useState<ResultatFull[]>([]);

  useEffect(() => {
    if (!classId) { setStudents([]); setAssessments([]); setResultats([]); return; }
    listStudentsInClass(ctx, classId).then(setStudents).catch(console.error);
  }, [classId]);

  useEffect(() => {
    if (!classId || !apprentissageId) { setAssessments([]); setResultats([]); return; }
    setLoading(true); setError(null);
    listResultatsForClassFull(ctx, classId)
      .then(({ students: s, assessments: a, resultats: r }) => {
        const filtered = a.filter(ev => ev.apprentissage_id === apprentissageId);
        const filteredIds = new Set(filtered.map(ev => ev.id));
        const filteredRes = r.filter(res => filteredIds.has(res.assessment_id));
        setStudents(s);
        setAssessments(filtered);
        setResultats(filteredRes);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [classId, apprentissageId]);

  const byStudentAssessment = new Map<string, ResultatFull>();
  for (const r of resultats) {
    byStudentAssessment.set(`${r.student_id}|${r.assessment_id}`, r);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <select value={classId} onChange={e => setClassId(e.target.value)} style={selectStyle}>
          <option value="">Choisir une classe…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={apprentissageId} onChange={e => setApprentissageId(e.target.value)} style={selectStyle}>
          <option value="">Choisir un apprentissage…</option>
          {apprentissages.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {error && <div style={{ color: "#dc2626", marginBottom: 12 }}>{error}</div>}
      {loading && <div style={{ color: "#64748b" }}>Chargement…</div>}

      {!loading && classId && apprentissageId && assessments.length === 0 && (
        <EmptyState msg="Aucune évaluation liée à cet apprentissage pour cette classe." />
      )}

      {!loading && assessments.length > 0 && students.length > 0 && (
        <div style={{ ...cardStyle, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, position: "sticky", left: 0, background: "#f8fafc", zIndex: 1 }}>Élève</th>
                {assessments.map(a => (
                  <th key={a.id} style={thStyle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                      <span>{a.title}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <TypeBadge type={a.type} />
                        {a.date && <span style={{ fontSize: 10, color: "#94a3b8" }}>{a.date}</span>}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td style={{ ...tdStyle, position: "sticky", left: 0, background: "#fff", fontWeight: 600 }}>
                    {s.last_name} {s.first_name}
                  </td>
                  {assessments.map(a => {
                    const r = byStudentAssessment.get(`${s.id}|${a.id}`);
                    return <ResultCell key={a.id} r={r} a={a} />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

export default function ResultatsPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [apprentissages, setApprentissages] = useState<Apprentissage[]>([]);
  const [tab, setTab] = useState<Tab>("classe");
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    getTeacherContext()
      .then(async (c) => {
        setCtx(c);
        const [cls, app] = await Promise.all([
          listClassGroups(c),
          listApprentissages(c),
        ]);
        setClasses(cls);
        setApprentissages(app);
      })
      .catch(e => setInitError(e.message));
  }, []);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "classe",       label: "Par classe",       icon: "👥" },
    { id: "eleve",        label: "Par élève",        icon: "🎓" },
    { id: "evaluation",   label: "Par évaluation",   icon: "📝" },
    { id: "apprentissage",label: "Par apprentissage", icon: "📚" },
  ];

  if (initError) {
    return (
      <div style={{ padding: 24, color: "#dc2626" }}>
        Erreur de chargement : {initError}
      </div>
    );
  }

  if (!ctx) {
    return <div style={{ padding: 24, color: "#64748b" }}>Chargement…</div>;
  }

  return (
    <div>
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0f172a", margin: 0 }}>
          📊 Résultats
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
          Consultez les résultats par classe, élève, évaluation ou apprentissage.
        </p>
      </div>

      {/* Onglets */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 24,
        background: "#f1f5f9", borderRadius: 12, padding: 4,
        width: "fit-content",
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              border: "none", cursor: "pointer", borderRadius: 9,
              padding: "7px 14px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? "#0f172a" : "#64748b",
              background: tab === t.id ? "#fff" : "transparent",
              boxShadow: tab === t.id ? "0 1px 4px rgba(15,23,42,0.10)" : "none",
              display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
            }}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {tab === "classe"        && <VueClasse        ctx={ctx} classes={classes} />}
      {tab === "eleve"         && <VueEleve         ctx={ctx} classes={classes} />}
      {tab === "evaluation"    && <VueEvaluation    ctx={ctx} classes={classes} />}
      {tab === "apprentissage" && <VueApprentissage ctx={ctx} classes={classes} apprentissages={apprentissages} />}
    </div>
  );
}

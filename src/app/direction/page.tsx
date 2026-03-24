"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

// ─── Design tokens ────────────────────────────────────────────────────────────
const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
const BG = "#F7F8FC";
const CARD = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb" } as React.CSSProperties;

const LEVEL_COLORS: Record<string, string> = { TB: "#16a34a", B: "#86efac", S: "#fbbf24", I: "#fb923c", NI: "#ef4444" };
const LEVEL_TEXT: Record<string, string>   = { TB: "#fff", B: "#14532d", S: "#78350f", I: "#7c2d12", NI: "#fff" };
const ALL_LEVELS = ["TB", "B", "S", "I", "NI"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type ClassGroup = { id: string; name: string; grade_level: number | null };
type Teacher    = { user_id: string; nom_affiche: string | null; matiere: string | null };
type Student    = { id: string; first_name: string; last_name: string; class_group_id?: string };
type Assessment = { id: string; title: string; date: string; type: string; max_points: number | null; class_group_id: string | null; course_id: string | null };
type Resultat   = { student_id: string; assessment_id: string; value: number | null; level: string | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number | string; color?: string }) {
  return (
    <div style={{ ...CARD, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color ?? "#0A84FF"}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900, color: color ?? "#111827" }}>{value}</div>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

function LevelDot({ level }: { level: string | null }) {
  if (!level) return <span style={{ color: "#9ca3af", fontSize: 11 }}>—</span>;
  return <span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 6, background: LEVEL_COLORS[level] ?? "#64748b", color: LEVEL_TEXT[level] ?? "#fff", fontSize: 11, fontWeight: 800 }}>{level}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DirectionPortal() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [resultats, setResultats] = useState<Resultat[]>([]);

  // Filters
  const [filterClass, setFilterClass] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<"overview" | "eleves" | "evaluations">("overview");

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      // Vérifier rôle admin
      const { data: mem } = await supabase
        .from("school_memberships")
        .select("school_id, role")
        .eq("user_id", user.id)
        .in("role", ["admin", "teacher"])
        .order("created_at")
        .limit(1)
        .maybeSingle();

      if (!mem) throw new Error("Accès non autorisé");
      const sid = mem.school_id;
      setSchoolId(sid);

      // Infos école
      const { data: school } = await supabase.from("schools").select("name").eq("id", sid).maybeSingle();
      setSchoolName(school?.name ?? "École");

      // Année scolaire
      const { data: ay } = await supabase.from("academic_years").select("id").eq("school_id", sid).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const ayId = ay?.id;

      // Classes
      const { data: cls } = await supabase.from("class_groups").select("id, name, grade_level").eq("school_id", sid).order("name");
      setClasses((cls ?? []) as ClassGroup[]);

      // Profs
      const { data: membs } = await supabase.from("school_memberships").select("user_id, nom_affiche, matiere").eq("school_id", sid).eq("role", "teacher");
      setTeachers((membs ?? []) as Teacher[]);

      // Élèves
      if (ayId) {
        const { data: enrols } = await supabase
          .from("student_enrollments")
          .select("student_id, class_group_id, students(id, first_name, last_name)")
          .eq("academic_year_id", ayId);

        const studMap = new Map<string, Student>();
        for (const e of (enrols ?? []) as any[]) {
          if (e.students && !studMap.has(e.students.id)) {
            studMap.set(e.students.id, { ...e.students, class_group_id: e.class_group_id });
          }
        }
        setStudents(Array.from(studMap.values()));
      }

      // Évaluations
      const { data: ass } = await supabase
        .from("assessments")
        .select("id, title, date, type, max_points, class_group_id, course_id")
        .eq("school_id", sid)
        .order("date", { ascending: false });
      setAssessments((ass ?? []) as Assessment[]);

      // Résultats (last 500 for perf)
      const { data: res } = await supabase
        .from("resultats")
        .select("student_id, assessment_id, value, level")
        .eq("school_id", sid)
        .limit(2000);
      setResultats((res ?? []) as Resultat[]);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Computed ──────────────────────────────────────────────────────────────
  const filteredStudents = students.filter(s => {
    if (filterClass !== "all" && s.class_group_id !== filterClass) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${s.first_name} ${s.last_name}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredAssessments = assessments.filter(a => {
    if (filterClass !== "all" && a.class_group_id !== filterClass) return false;
    if (filterType !== "all" && a.type !== filterType) return false;
    return true;
  });

  function studentLevel(studentId: string): string | null {
    const levels = resultats.filter(r => r.student_id === studentId && r.level).map(r => r.level!) ;
    if (!levels.length) return null;
    const order = ["NI","I","S","B","TB"];
    const avg = levels.reduce((s, l) => s + order.indexOf(l), 0) / levels.length;
    return order[Math.round(avg)] ?? null;
  }

  function levelDistribution() {
    const dist: Record<string, number> = { TB: 0, B: 0, S: 0, I: 0, NI: 0, none: 0 };
    for (const s of students) {
      const lv = studentLevel(s.id);
      if (lv) dist[lv]++;
      else dist.none++;
    }
    return dist;
  }

  const dist = levelDistribution();
  const totalWithLevel = students.filter(s => studentLevel(s.id) !== null).length;

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#9ca3af" }}>Chargement…</span>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 36 }}>⚠️</div>
      <div style={{ color: "#dc2626" }}>{error}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#111827" }}>
      {/* Header */}
      <div style={{ background: GRADIENT, padding: "28px 32px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>🏫</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff" }}>Portail Direction</h1>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{schoolName}</p>
            </div>
          </div>
          <Link href="/teacher" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", padding: "8px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            ← Vue professeur
          </Link>
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          {(["overview", "eleves", "evaluations"] as const).map(v => (
            <button key={v} onClick={() => setActiveView(v)}
              style={{ background: activeView === v ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.12)", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: activeView === v ? "#0f172a" : "#fff", cursor: "pointer" }}>
              {{ overview: "📊 Vue d'ensemble", eleves: "👥 Élèves", evaluations: "📝 Évaluations" }[v]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "28px 32px" }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
            style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, color: "#374151", padding: "9px 14px", fontSize: 13 }}>
            <option value="all">Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {activeView === "evaluations" && (
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, color: "#374151", padding: "9px 14px", fontSize: 13 }}>
              <option value="all">Tous les types</option>
              <option value="summative">Sommatives</option>
              <option value="formative">Formatives</option>
            </select>
          )}

          {activeView === "eleves" && (
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher un élève…"
              style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, color: "#374151", padding: "9px 14px", fontSize: 13, minWidth: 220 }} />
          )}

          <div style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>
            {filterClass !== "all" ? `Classe : ${classes.find(c => c.id === filterClass)?.name}` : `${classes.length} classes · ${students.length} élèves`}
          </div>
        </div>

        {/* ── Overview ── */}
        {activeView === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
              <StatCard icon="🏫" label="Classes" value={classes.length} color="#0A84FF" />
              <StatCard icon="👨‍🏫" label="Enseignants" value={teachers.length} color="#a78bfa" />
              <StatCard icon="👥" label="Élèves" value={students.length} color="#34d399" />
              <StatCard icon="📝" label="Évaluations" value={assessments.length} color="#fbbf24" />
              <StatCard icon="✅" label="Résultats" value={resultats.length} color="#60a5fa" />
            </div>

            {/* Level distribution */}
            {totalWithLevel > 0 && (
              <div style={{ ...CARD, padding: "24px 28px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Répartition des niveaux — École
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  {ALL_LEVELS.map(lv => {
                    const count = dist[lv];
                    const pct = totalWithLevel > 0 ? Math.round((count / totalWithLevel) * 100) : 0;
                    return (
                      <div key={lv} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 60 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>{count}</div>
                        <div style={{ width: 48, height: Math.max(8, pct * 1.5), borderRadius: "4px 4px 0 0", background: LEVEL_COLORS[lv], transition: "height 0.3s" }} />
                        <div style={{ padding: "2px 8px", borderRadius: 6, background: LEVEL_COLORS[lv], color: LEVEL_TEXT[lv], fontSize: 11, fontWeight: 800 }}>{lv}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{pct}%</div>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 60 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#9ca3af" }}>{dist.none}</div>
                    <div style={{ width: 48, height: Math.max(8, (dist.none / students.length) * 150), borderRadius: "4px 4px 0 0", background: "#e5e7eb" }} />
                    <div style={{ padding: "2px 8px", borderRadius: 6, background: "#e5e7eb", color: "#6b7280", fontSize: 11, fontWeight: 800 }}>—</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>non éval.</div>
                  </div>
                </div>
              </div>
            )}

            {/* Classes overview */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Classes</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {classes.map(cls => {
                  const classStudents = students.filter(s => s.class_group_id === cls.id);
                  const classAssessments = assessments.filter(a => a.class_group_id === cls.id);
                  return (
                    <div key={cls.id} style={{ ...CARD, padding: "16px 20px" }}>
                      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{cls.name}</div>
                      <div style={{ display: "flex", gap: 16 }}>
                        <div><span style={{ fontSize: 18, fontWeight: 900, color: "#60a5fa" }}>{classStudents.length}</span><span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>élèves</span></div>
                        <div><span style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24" }}>{classAssessments.length}</span><span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>évals</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Élèves ── */}
        {activeView === "eleves" && (
          <div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>{filteredStudents.length} élève{filteredStudents.length > 1 ? "s" : ""}</div>
            <div style={{ overflowX: "auto", borderRadius: 16 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 600 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {["Élève", "Classe", "Évals", "Résultats", "Niveau global"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, i) => {
                    const cls = classes.find(c => c.id === s.class_group_id);
                    const studAssIds = assessments.filter(a => a.class_group_id === s.class_group_id).map(a => a.id);
                    const studRes = resultats.filter(r => r.student_id === s.id && studAssIds.includes(r.assessment_id));
                    const lv = studentLevel(s.id);
                    return (
                      <tr key={s.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td style={{ padding: "11px 16px", borderBottom: "1px solid #f1f5f9" }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{s.first_name} {s.last_name.toUpperCase()}</div>
                        </td>
                        <td style={{ padding: "11px 16px", fontSize: 13, color: "#6b7280", borderBottom: "1px solid #f1f5f9" }}>{cls?.name ?? "—"}</td>
                        <td style={{ padding: "11px 16px", fontSize: 13, color: "#2563eb", fontWeight: 700, borderBottom: "1px solid #f1f5f9" }}>{studAssIds.length}</td>
                        <td style={{ padding: "11px 16px", fontSize: 13, color: "#16a34a", fontWeight: 700, borderBottom: "1px solid #f1f5f9" }}>{studRes.length}</td>
                        <td style={{ padding: "11px 16px", borderBottom: "1px solid #f1f5f9" }}><LevelDot level={lv} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Évaluations ── */}
        {activeView === "evaluations" && (
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>{filteredAssessments.length} évaluation{filteredAssessments.length > 1 ? "s" : ""}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredAssessments.map(a => {
                const cls = classes.find(c => c.id === a.class_group_id);
                const assRes = resultats.filter(r => r.assessment_id === a.id);
                const levDist = ALL_LEVELS.reduce((acc, lv) => { acc[lv] = assRes.filter(r => r.level === lv).length; return acc; }, {} as Record<string, number>);
                return (
                  <div key={a.id} style={{ ...CARD, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: a.type === "summative" ? "rgba(255,59,48,0.15)" : "rgba(10,132,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                      {a.type === "summative" ? "📝" : "📚"}
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                        {new Date(a.date).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" })}
                        {cls && ` · ${cls.name}`}
                        {a.max_points && ` · /${a.max_points}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {ALL_LEVELS.map(lv => levDist[lv] > 0 ? (
                        <span key={lv} style={{ display: "inline-flex", alignItems: "center", gap: 3, background: LEVEL_COLORS[lv], color: LEVEL_TEXT[lv], borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 800 }}>
                          {lv} ×{levDist[lv]}
                        </span>
                      ) : null)}
                      {assRes.length === 0 && <span style={{ fontSize: 12, color: "#9ca3af" }}>Aucun résultat</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

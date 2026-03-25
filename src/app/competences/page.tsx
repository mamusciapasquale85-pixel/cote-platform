"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getTeacherContext,
  listClassGroups,
  listStudentsForClass,
  listApprentissages,
  listAssessmentsForClass,
  listResultatsForAssessments,
  computeCompetenceGrid,
  countLevelsForApprentissage,
  getSchoolTemplate,
  LEVEL_COLORS,
  LEVEL_TEXT_COLORS,
  ALL_LEVELS,
  type TeacherContext,
  type ClassGroup,
  type Student,
  type Apprentissage,
  type Assessment,
  type CompetenceGrid,
  type Level,
  type SchoolTemplate,
} from "./competences";

// ─── Design tokens ────────────────────────────────────────────────────────────

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid rgba(15,23,42,0.08)",
  boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
  padding: "24px 28px",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: Level | null }) {
  if (!level) {
    return (
      <span
        style={{
          display: "inline-block",
          width: 36,
          height: 28,
          borderRadius: 8,
          background: "rgba(15,23,42,0.06)",
          color: "rgba(15,23,42,0.25)",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: "28px",
          textAlign: "center",
        }}
      >
        —
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-block",
        width: 36,
        height: 28,
        borderRadius: 8,
        background: LEVEL_COLORS[level],
        color: LEVEL_TEXT_COLORS[level],
        fontSize: 12,
        fontWeight: 800,
        lineHeight: "28px",
        textAlign: "center",
      }}
    >
      {level}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompetencesPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [apprentissages, setApprentissages] = useState<Apprentissage[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [grid, setGrid] = useState<CompetenceGrid>({});
  const [template, setTemplate] = useState<SchoolTemplate>({ school_name: "", teacher_name: "", address: "" });

  const [loading, setLoading] = useState(true);
  const [loadingClass, setLoadingClass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Init
  useEffect(() => {
    (async () => {
      try {
        const c = await getTeacherContext();
        const [cls, apps, tpl] = await Promise.all([
          listClassGroups(c),
          listApprentissages(c),
          getSchoolTemplate(c.supabase),
        ]);
        setCtx(c);
        setClasses(cls);
        setApprentissages(apps);
        setTemplate(tpl);
        if (cls.length > 0) setSelectedClass(cls[0]);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load class data
  const loadClassData = useCallback(async (c: TeacherContext, cls: ClassGroup, apps: Apprentissage[]) => {
    setLoadingClass(true);
    try {
      const [sts, assessList] = await Promise.all([
        listStudentsForClass(c, cls.id),
        listAssessmentsForClass(c, cls.id),
      ]);
      const assessmentIds = assessList.map((a) => a.id);
      const resultats = await listResultatsForAssessments(c, assessmentIds);
      const g = computeCompetenceGrid(sts, apps, assessList, resultats);
      setStudents(sts);
      setAssessments(assessList);
      setGrid(g);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingClass(false);
    }
  }, []);

  useEffect(() => {
    if (ctx && selectedClass && apprentissages.length >= 0) {
      void loadClassData(ctx, selectedClass, apprentissages);
    }
  }, [ctx, selectedClass, apprentissages, loadClassData]);

  // ─── PDF export ─────────────────────────────────────────────────────────────

  async function handleDownloadPDF() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const PAGE_W = 297;
    const PAGE_H = 210;
    const ML = 14;
    const MR = 14;
    const contentW = PAGE_W - ML - MR;

    // Header gradient band
    doc.setFillColor(255, 59, 48);
    doc.rect(0, 0, PAGE_W, 18, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("KLASBOOK — Grille de compétences FWB", ML, 12);

    // School + class info
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    const meta = [
      template.school_name || "—",
      selectedClass ? `Classe : ${selectedClass.name}` : "",
      `Date : ${new Date().toLocaleDateString("fr-BE")}`,
    ]
      .filter(Boolean)
      .join("   •   ");
    doc.text(meta, PAGE_W - MR, 12, { align: "right" });

    if (apprentissages.length === 0 || students.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("Aucune donnée à afficher.", ML, 40);
      doc.save(`competences_${selectedClass?.name ?? "classe"}.pdf`);
      return;
    }

    // Table parameters
    const startY = 24;
    const rowH = 10;
    const appColW = 80;
    const levelColW = Math.max(18, Math.min(30, (contentW - appColW) / students.length));
    const tableW = appColW + students.length * levelColW;

    // Header row — student names
    doc.setFillColor(15, 23, 42);
    doc.rect(ML, startY, tableW, rowH, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Compétence / Apprentissage", ML + 2, startY + 6.5);

    students.forEach((s, i) => {
      const x = ML + appColW + i * levelColW;
      const name = `${s.last_name.slice(0, 8)}`;
      doc.text(name, x + levelColW / 2, startY + 6.5, { align: "center" });
    });

    // Data rows
    let currentY = startY + rowH;
    const colors: Record<string, [number, number, number]> = {
      TB: [22, 163, 74],
      B:  [134, 239, 172],
      S:  [251, 191, 36],
      I:  [251, 146, 60],
      NI: [239, 68, 68],
    };

    apprentissages.forEach((app, rowIdx) => {
      const rowBg = rowIdx % 2 === 0 ? [30, 41, 59] : [22, 32, 50];
      doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
      doc.rect(ML, currentY, tableW, rowH, "F");

      // Apprentissage name
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(220, 230, 240);
      const appName = app.name.length > 38 ? app.name.slice(0, 36) + "…" : app.name;
      doc.text(appName, ML + 2, currentY + 6.5);

      // Level cells
      students.forEach((s, i) => {
        const x = ML + appColW + i * levelColW;
        const level = grid[app.id]?.[s.id] ?? null;
        if (level && colors[level]) {
          const [r, g, b] = colors[level];
          doc.setFillColor(r, g, b);
          doc.roundedRect(x + 2, currentY + 1.5, levelColW - 4, rowH - 3, 2, 2, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(level === "B" || level === "S" ? 20 : 255, level === "B" || level === "S" ? 60 : 255, level === "B" || level === "S" ? 20 : 255);
          doc.text(level, x + levelColW / 2, currentY + 6.5, { align: "center" });
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(80, 100, 120);
          doc.text("—", x + levelColW / 2, currentY + 6.5, { align: "center" });
        }
      });

      currentY += rowH;

      // New page if needed
      if (currentY > PAGE_H - 20) {
        doc.addPage();
        currentY = 20;
      }
    });

    // Legend
    const legendY = Math.min(currentY + 6, PAGE_H - 12);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const levels: Level[] = ["TB", "B", "S", "I", "NI"];
    const labels: Record<Level, string> = { TB: "Très bien", B: "Bien", S: "Suffisant", I: "Insuffisant", NI: "Non initié" };
    let lx = ML;
    levels.forEach((lv) => {
      const [r, g, b] = colors[lv];
      doc.setFillColor(r, g, b);
      doc.roundedRect(lx, legendY, 6, 4, 1, 1, "F");
      doc.setTextColor(150, 165, 180);
      doc.text(`${lv} = ${labels[lv]}`, lx + 8, legendY + 3.2);
      lx += 40;
    });

    doc.save(`competences_${selectedClass?.name ?? "classe"}.pdf`);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#94a3b8", fontSize: 16 }}>Chargement…</span>
      </div>
    );
  }

  return (
    <div>
        {error && (
          <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, color: "#991B1B" }}>
            Erreur : {error}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 28, flexWrap: "wrap" }}>
          {/* Class selector */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Classe
            </label>
            <select
              value={selectedClass?.id ?? ""}
              onChange={(e) => {
                const c = classes.find((c) => c.id === e.target.value) ?? null;
                setSelectedClass(c);
              }}
              style={{
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.15)",
                borderRadius: 10,
                color: "#0f172a",
                padding: "10px 14px",
                fontSize: 14,
                minWidth: 160,
                cursor: "pointer",
              }}
            >
              {classes.length === 0 && <option value="">Aucune classe</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* PDF button */}
          <div style={{ marginTop: 22 }}>
            <button
              onClick={handleDownloadPDF}
              disabled={loadingClass || students.length === 0}
              style={{
                background: loadingClass || students.length === 0 ? "rgba(255,255,255,0.1)" : GRADIENT,
                border: "none",
                borderRadius: 10,
                color: "#fff",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: loadingClass || students.length === 0 ? "not-allowed" : "pointer",
                opacity: loadingClass || students.length === 0 ? 0.5 : 1,
              }}
            >
              📄 Exporter PDF Klasbook
            </button>
          </div>

          {/* Link to apprentissages */}
          <div style={{ marginTop: 22, marginLeft: "auto" }}>
            <Link
              href="/apprentissages"
              style={{
                background: "rgba(15,23,42,0.04)",
                border: "1px solid rgba(15,23,42,0.12)",
                borderRadius: 10,
                color: "#475569",
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              ⚙️ Gérer les apprentissages
            </Link>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {ALL_LEVELS.map((lv) => (
            <div key={lv} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 32,
                  height: 22,
                  borderRadius: 6,
                  background: LEVEL_COLORS[lv],
                  color: LEVEL_TEXT_COLORS[lv],
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: "22px",
                  textAlign: "center",
                }}
              >
                {lv}
              </span>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {{
                  TB: "Très bien",
                  B: "Bien",
                  S: "Suffisant",
                  I: "Insuffisant",
                  NI: "Non initié",
                }[lv]}
              </span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 32,
                height: 22,
                borderRadius: 6,
                background: "rgba(15,23,42,0.06)",
                color: "rgba(15,23,42,0.25)",
                fontSize: 11,
                fontWeight: 800,
                lineHeight: "22px",
                textAlign: "center",
              }}
            >
              —
            </span>
            <span style={{ fontSize: 12, color: "#64748b" }}>Non évalué</span>
          </div>
        </div>

        {/* Table */}
        {loadingClass ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            Chargement de la classe…
          </div>
        ) : apprentissages.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
              Aucun apprentissage configuré
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              Configurez vos apprentissages pour voir la grille de compétences.
            </div>
            <Link href="/apprentissages" style={{ background: GRADIENT, borderRadius: 10, color: "#fff", padding: "10px 20px", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              Gérer les apprentissages →
            </Link>
          </div>
        ) : students.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              Aucun élève dans cette classe
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: 16 }}>
            <table style={{ borderCollapse: "collapse", minWidth: "100%", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 280 }} />
                {students.map((s) => (
                  <col key={s.id} style={{ width: 68 }} />
                ))}
                <col style={{ width: 120 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ background: "#f1f5f9", color: "#64748b", fontSize: 11, fontWeight: 700, padding: "12px 16px", textAlign: "left", position: "sticky", left: 0, zIndex: 2, borderBottom: "1px solid rgba(15,23,42,0.08)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Compétence / Apprentissage
                  </th>
                  {students.map((s) => (
                    <th key={s.id} style={{ background: "#f1f5f9", color: "#0f172a", fontSize: 11, fontWeight: 700, padding: "10px 4px", textAlign: "center", borderBottom: "1px solid rgba(15,23,42,0.08)", maxWidth: 68, overflow: "hidden" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(10,132,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#60a5fa", fontWeight: 900 }}>
                          {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                        </div>
                        <span style={{ fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 64, display: "block" }}>
                          {s.last_name}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th style={{ background: "#f1f5f9", color: "#64748b", fontSize: 10, fontWeight: 600, padding: "12px 8px", textAlign: "center", borderBottom: "1px solid rgba(15,23,42,0.08)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Répartition
                  </th>
                </tr>
              </thead>
              <tbody>
                {apprentissages.map((app, rowIdx) => {
                  const counts = countLevelsForApprentissage(grid, app.id, students);
                  const notEvaluated = counts.none;
                  return (
                    <tr key={app.id} style={{ background: rowIdx % 2 === 0 ? "#fff" : "rgba(15,23,42,0.02)" }}>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#334155", position: "sticky", left: 0, background: rowIdx % 2 === 0 ? "#fff" : "rgba(15,23,42,0.02)", borderBottom: "1px solid rgba(15,23,42,0.06)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {app.name}
                      </td>
                      {students.map((s) => (
                        <td key={s.id} style={{ padding: "8px 4px", textAlign: "center", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                          <LevelBadge level={grid[app.id]?.[s.id] ?? null} />
                        </td>
                      ))}
                      {/* Distribution mini bar */}
                      <td style={{ padding: "8px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                        <div style={{ display: "flex", gap: 2, alignItems: "center", justifyContent: "center" }}>
                          {(["TB", "B", "S", "I", "NI"] as Level[]).map((lv) =>
                            counts[lv] > 0 ? (
                              <span
                                key={lv}
                                title={`${lv}: ${counts[lv]}`}
                                style={{
                                  display: "inline-block",
                                  width: 16,
                                  height: 16,
                                  borderRadius: 4,
                                  background: LEVEL_COLORS[lv],
                                  color: LEVEL_TEXT_COLORS[lv],
                                  fontSize: 9,
                                  fontWeight: 900,
                                  lineHeight: "16px",
                                  textAlign: "center",
                                }}
                              >
                                {counts[lv]}
                              </span>
                            ) : null
                          )}
                          {notEvaluated > 0 && (
                            <span
                              title={`Non évalués: ${notEvaluated}`}
                              style={{ fontSize: 10, color: "#94a3b8", marginLeft: 2 }}
                            >
                              +{notEvaluated}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        {!loadingClass && students.length > 0 && apprentissages.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 12, color: "#94a3b8", textAlign: "right" }}>
            {students.length} élèves · {apprentissages.length} compétences · {assessments.length} évaluations liées
          </div>
        )}
      </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getTeacherContext,
  listClassGroups,
  listStudentsForClass,
  listApprentissages,
  listAssessmentsForClass,
  listResultatsForAssessments,
  computeCompetenceGrid,
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
} from "../competences/competences";

// ─── Design tokens ────────────────────────────────────────────────────────────

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

// ─── Periods ─────────────────────────────────────────────────────────────────

type Period = "T1" | "T2" | "T3" | "all";

const PERIODS: { id: Period; label: string; dateFrom: string; dateTo: string }[] = [
  { id: "T1", label: "T1 — Sept–Déc", dateFrom: `${new Date().getFullYear() - (new Date().getMonth() < 7 ? 1 : 0)}-09-01`, dateTo: `${new Date().getFullYear() - (new Date().getMonth() < 7 ? 1 : 0)}-12-31` },
  { id: "T2", label: "T2 — Jan–Mar", dateFrom: `${new Date().getMonth() < 7 ? new Date().getFullYear() : new Date().getFullYear() + 1}-01-01`, dateTo: `${new Date().getMonth() < 7 ? new Date().getFullYear() : new Date().getFullYear() + 1}-03-31` },
  { id: "T3", label: "T3 — Avr–Juin", dateFrom: `${new Date().getMonth() < 7 ? new Date().getFullYear() : new Date().getFullYear() + 1}-04-01`, dateTo: `${new Date().getMonth() < 7 ? new Date().getFullYear() : new Date().getFullYear() + 1}-06-30` },
  { id: "all", label: "Annuel", dateFrom: "", dateTo: "" },
];

// ─── Level helper ─────────────────────────────────────────────────────────────

function getOverallLevel(levels: (Level | null)[]): Level | null {
  const valid = levels.filter(Boolean) as Level[];
  if (valid.length === 0) return null;
  const order: Level[] = ["NI", "I", "S", "B", "TB"];
  const avg = valid.reduce((sum, l) => sum + order.indexOf(l), 0) / valid.length;
  return order[Math.round(avg)] ?? null;
}

function LevelBadge({ level }: { level: Level | null }) {
  if (!level) return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 8, background: "rgba(15,23,42,0.06)", color: "rgba(15,23,42,0.25)", fontSize: 12, fontWeight: 700 }}>—</span>
  );
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 8, background: LEVEL_COLORS[level], color: LEVEL_TEXT_COLORS[level], fontSize: 12, fontWeight: 800 }}>
      {level}
    </span>
  );
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function generateBulletinPDF(
  student: Student,
  classGroup: ClassGroup,
  period: Period,
  periodLabel: string,
  apprentissages: Apprentissage[],
  grid: CompetenceGrid,
  template: SchoolTemplate,
  appreciation: string
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const ML = 18;
  const MR = 18;
  const CW = PAGE_W - ML - MR;

  // ── Header banner
  doc.setFillColor(255, 59, 48);
  doc.rect(0, 0, PAGE_W, 30, "F");
  doc.setFillColor(10, 132, 255);
  doc.rect(0, 24, PAGE_W, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("KLASBOOK", ML, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Fédération Wallonie-Bruxelles", ML, 20);

  if (template.school_name) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(template.school_name.toUpperCase(), PAGE_W - MR, 14, { align: "right" });
  }
  if (template.address) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(template.address, PAGE_W - MR, 20, { align: "right" });
  }

  // ── Title
  let y = 44;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("BULLETIN DE L'ÉLÈVE", PAGE_W / 2, y, { align: "center" });

  y += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Période : ${periodLabel}`, PAGE_W / 2, y, { align: "center" });

  // ── Student info box
  y += 10;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(ML, y, CW, 22, 4, 4, "F");

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${student.first_name} ${student.last_name.toUpperCase()}`, ML + 8, y + 9);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Classe : ${classGroup.name}`, ML + 8, y + 16);
  doc.text(`Date d'édition : ${new Date().toLocaleDateString("fr-BE")}`, PAGE_W - MR - 8, y + 16, { align: "right" });

  // ── Competences table
  y += 30;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Résultats par compétence", ML, y);

  y += 6;

  // Table header
  const colAppW = CW * 0.72;
  const colLvW = CW * 0.28;
  const rowH = 9;

  doc.setFillColor(15, 23, 42);
  doc.rect(ML, y, CW, rowH, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Apprentissage / Compétence", ML + 4, y + 6);
  doc.text("Niveau", ML + colAppW + colLvW / 2, y + 6, { align: "center" });

  y += rowH;

  const levelColors: Record<Level, [number, number, number]> = {
    TB: [22, 163, 74],
    B:  [134, 239, 172],
    S:  [251, 191, 36],
    I:  [251, 146, 60],
    NI: [239, 68, 68],
  };

  apprentissages.forEach((app, idx) => {
    const level = grid[app.id]?.[student.id] ?? null;
    const bg = idx % 2 === 0 ? [248, 250, 252] : [241, 245, 249];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(ML, y, CW, rowH, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    const appName = app.name.length > 60 ? app.name.slice(0, 58) + "…" : app.name;
    doc.text(appName, ML + 4, y + 6);

    if (level && levelColors[level]) {
      const [r, g, b] = levelColors[level];
      doc.setFillColor(r, g, b);
      doc.roundedRect(ML + colAppW + 4, y + 1.5, colLvW - 8, rowH - 3, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(level === "B" || level === "S" ? 20 : 255, level === "B" || level === "S" ? 60 : 255, level === "B" || level === "S" ? 20 : 255);
      doc.text(level, ML + colAppW + colLvW / 2, y + 6, { align: "center" });
    } else {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 165, 180);
      doc.text("—", ML + colAppW + colLvW / 2, y + 6, { align: "center" });
    }

    y += rowH;
    if (y > PAGE_H - 50) {
      doc.addPage();
      y = 20;
    }
  });

  // ── Legend
  y += 6;
  const levels: Level[] = ["TB", "B", "S", "I", "NI"];
  const labels: Record<Level, string> = { TB: "Très bien", B: "Bien", S: "Suffisant", I: "Insuffisant", NI: "Non initié" };
  doc.setFontSize(7);
  let lx = ML;
  levels.forEach((lv) => {
    const [r, g, b] = levelColors[lv];
    doc.setFillColor(r, g, b);
    doc.roundedRect(lx, y, 5, 3.5, 0.5, 0.5, "F");
    doc.setTextColor(80, 100, 120);
    doc.text(`${lv} = ${labels[lv]}`, lx + 6.5, y + 2.8);
    lx += 38;
  });

  // ── Appreciation
  if (appreciation) {
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Appréciation de l'enseignant", ML, y);
    y += 6;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(ML, y, CW, 28, 4, 4, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(appreciation, CW - 8);
    doc.text(lines, ML + 4, y + 6);
    y += 32;
  }

  // ── Signature zone
  y = Math.max(y + 10, PAGE_H - 50);
  doc.setDrawColor(200, 210, 220);
  doc.line(ML, y, ML + CW * 0.45, y);
  doc.line(ML + CW * 0.55, y, ML + CW, y);
  doc.setFontSize(8);
  doc.setTextColor(100, 120, 140);
  doc.text("Signature de l'enseignant", ML, y + 5);
  doc.text("Signature des parents", ML + CW * 0.55, y + 5);
  if (template.teacher_name) {
    doc.setFont("helvetica", "italic");
    doc.text(template.teacher_name, ML, y + 12);
  }

  // ── Footer
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(160, 175, 190);
  doc.text("Généré par Klasbook · FWB · klasbook.be", PAGE_W / 2, PAGE_H - 8, { align: "center" });

  doc.save(`bulletin_${student.last_name}_${student.first_name}_${period}.pdf`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BulletinsPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [period, setPeriod] = useState<Period>("all");
  const [students, setStudents] = useState<Student[]>([]);
  const [apprentissages, setApprentissages] = useState<Apprentissage[]>([]);
  const [grid, setGrid] = useState<CompetenceGrid>({});
  const [template, setTemplate] = useState<SchoolTemplate>({ school_name: "", teacher_name: "", address: "" });

  const [loading, setLoading] = useState(true);
  const [loadingClass, setLoadingClass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-student appreciation state
  const [appreciations, setAppreciations] = useState<Record<string, string>>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [downloadingFor, setDownloadingFor] = useState<string | null>(null);

  // Modal state
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);

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
  const loadClassData = useCallback(
    async (c: TeacherContext, cls: ClassGroup, apps: Apprentissage[], p: Period) => {
      setLoadingClass(true);
      setAppreciations({});
      try {
        const periodDef = PERIODS.find((x) => x.id === p)!;
        const [sts, assessList] = await Promise.all([
          listStudentsForClass(c, cls.id),
          listAssessmentsForClass(
            c,
            cls.id,
            p !== "all" ? periodDef.dateFrom : undefined,
            p !== "all" ? periodDef.dateTo : undefined
          ),
        ]);
        const assessmentIds = assessList.map((a) => a.id);
        const resultats = await listResultatsForAssessments(c, assessmentIds);
        const g = computeCompetenceGrid(sts, apps, assessList, resultats);
        setStudents(sts);
        setGrid(g);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoadingClass(false);
      }
    },
    []
  );

  useEffect(() => {
    if (ctx && selectedClass) {
      void loadClassData(ctx, selectedClass, apprentissages, period);
    }
  }, [ctx, selectedClass, apprentissages, period, loadClassData]);

  // Generate appreciation via Claude API
  async function generateAppreciation(student: Student) {
    setGeneratingFor(student.id);
    try {
      const studentLevels = apprentissages.map((app) => ({
        competence: app.name,
        level: grid[app.id]?.[student.id] ?? null,
      }));
      const summary = studentLevels
        .filter((x) => x.level)
        .map((x) => `${x.competence} : ${x.level}`)
        .join(", ");

      const response = await fetch("/api/generer-appreciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: `${student.first_name} ${student.last_name}`,
          class_name: selectedClass?.name ?? "",
          period: PERIODS.find((p2) => p2.id === period)?.label ?? period,
          results_summary: summary || "Aucun résultat enregistré",
        }),
      });

      if (!response.ok) throw new Error("Erreur API");
      const data = await response.json();
      setAppreciations((prev) => ({ ...prev, [student.id]: data.appreciation ?? "" }));
    } catch {
      setAppreciations((prev) => ({
        ...prev,
        [student.id]: `${student.first_name} a travaillé sérieusement au cours de cette période.`,
      }));
    } finally {
      setGeneratingFor(null);
    }
  }

  // Download bulletin PDF for one student
  async function downloadBulletin(student: Student) {
    setDownloadingFor(student.id);
    try {
      const periodDef = PERIODS.find((p2) => p2.id === period)!;
      await generateBulletinPDF(
        student,
        selectedClass!,
        period,
        periodDef.label,
        apprentissages,
        grid,
        template,
        appreciations[student.id] ?? ""
      );
    } finally {
      setDownloadingFor(null);
    }
  }

  // Download all bulletins (one PDF per student)
  async function downloadAllBulletins() {
    for (const student of students) {
      await downloadBulletin(student);
    }
  }

  // Student overall level
  function studentOverallLevel(student: Student): Level | null {
    const levels = apprentissages.map((app) => grid[app.id]?.[student.id] ?? null);
    return getOverallLevel(levels);
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
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap" }}>
          {/* Class */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
              Classe
            </label>
            <select
              value={selectedClass?.id ?? ""}
              onChange={(e) => {
                const c = classes.find((cl) => cl.id === e.target.value) ?? null;
                setSelectedClass(c);
              }}
              style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, color: "#0f172a", padding: "10px 14px", fontSize: 14, minWidth: 160, cursor: "pointer" }}
            >
              {classes.length === 0 && <option value="">Aucune classe</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Period */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
              Période
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {PERIODS.map((p2) => (
                <button
                  key={p2.id}
                  onClick={() => setPeriod(p2.id)}
                  style={{
                    background: period === p2.id ? "#0A84FF" : "#fff",
                    border: `1px solid ${period === p2.id ? "#0A84FF" : "rgba(15,23,42,0.15)"}`,
                    borderRadius: 10,
                    color: period === p2.id ? "#fff" : "#0f172a",
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: period === p2.id ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {p2.label}
                </button>
              ))}
            </div>
          </div>

          {/* Download all */}
          {students.length > 0 && apprentissages.length > 0 && (
            <button
              onClick={downloadAllBulletins}
              disabled={loadingClass}
              style={{
                background: GRADIENT,
                border: "none",
                borderRadius: 10,
                color: "#fff",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: loadingClass ? "not-allowed" : "pointer",
                opacity: loadingClass ? 0.5 : 1,
              }}
            >
              📥 Télécharger tous les bulletins
            </button>
          )}
        </div>

        {/* Student list */}
        {loadingClass ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            Chargement…
          </div>
        ) : apprentissages.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
              Aucun apprentissage configuré
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Les bulletins sont générés à partir de vos apprentissages et de leurs résultats.
            </div>
          </div>
        ) : students.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Aucun élève dans cette classe</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {students.map((student) => {
              const overall = studentOverallLevel(student);
              const apprecText = appreciations[student.id] ?? "";
              const isGenerating = generatingFor === student.id;
              const isDownloading = downloadingFor === student.id;

              return (
                <div
                  key={student.id}
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    border: "1px solid rgba(15,23,42,0.08)",
                    boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
                    padding: "16px 20px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    {/* Avatar */}
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(10,132,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#60a5fa", flexShrink: 0 }}>
                      {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                    </div>

                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                        {student.first_name} {student.last_name.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {apprentissages.length} compétences
                      </div>
                    </div>

                    {/* Overall level */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Niveau global</span>
                      <div
                        style={{
                          padding: "4px 12px",
                          borderRadius: 10,
                          background: overall ? LEVEL_COLORS[overall] : "rgba(15,23,42,0.06)",
                          color: overall ? LEVEL_TEXT_COLORS[overall] : "rgba(15,23,42,0.25)",
                          fontWeight: 800,
                          fontSize: 14,
                        }}
                      >
                        {overall ?? "—"}
                      </div>
                    </div>

                    {/* Mini level distribution */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {ALL_LEVELS.map((lv) => {
                        const count = apprentissages.filter((app) => grid[app.id]?.[student.id] === lv).length;
                        if (count === 0) return null;
                        return (
                          <span
                            key={lv}
                            title={`${lv}: ${count} compétence(s)`}
                            style={{ display: "inline-flex", alignItems: "center", gap: 3, background: LEVEL_COLORS[lv], color: LEVEL_TEXT_COLORS[lv], borderRadius: 8, padding: "3px 7px", fontSize: 11, fontWeight: 800 }}
                          >
                            {lv} <span style={{ fontSize: 10, opacity: 0.85 }}>×{count}</span>
                          </span>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                      <button
                        onClick={() => generateAppreciation(student)}
                        disabled={isGenerating}
                        style={{
                          background: isGenerating ? "rgba(15,23,42,0.06)" : "rgba(10,132,255,0.10)",
                          border: "1px solid rgba(10,132,255,0.3)",
                          borderRadius: 8,
                          color: "#60a5fa",
                          padding: "7px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: isGenerating ? "not-allowed" : "pointer",
                          opacity: isGenerating ? 0.6 : 1,
                        }}
                      >
                        {isGenerating ? "⏳ Génération…" : "✨ Appréciation IA"}
                      </button>

                      <button
                        onClick={() => downloadBulletin(student)}
                        disabled={isDownloading}
                        style={{
                          background: isDownloading ? "rgba(15,23,42,0.06)" : GRADIENT,
                          border: "none",
                          borderRadius: 8,
                          color: "#fff",
                          padding: "7px 14px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: isDownloading ? "not-allowed" : "pointer",
                          opacity: isDownloading ? 0.6 : 1,
                        }}
                      >
                        {isDownloading ? "⏳ PDF…" : "📄 Bulletin PDF"}
                      </button>
                    </div>
                  </div>

                  {/* Appreciation text (if generated) */}
                  {apprecText && (
                    <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <textarea
                        value={apprecText}
                        onChange={(e) =>
                          setAppreciations((prev) => ({ ...prev, [student.id]: e.target.value }))
                        }
                        rows={2}
                        style={{
                          flex: 1,
                          background: "rgba(10,132,255,0.05)",
                          border: "1px solid rgba(10,132,255,0.2)",
                          borderRadius: 8,
                          color: "#0f172a",
                          padding: "8px 12px",
                          fontSize: 13,
                          resize: "vertical",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}

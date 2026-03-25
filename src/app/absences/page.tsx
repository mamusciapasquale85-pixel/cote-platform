"use client";

import { useEffect, useState, useCallback } from "react";
import {
  type UUID,
  type TeacherContext,
  type ClassGroup,
  type AttendancePeriodSummaryRow,
  getTeacherContext,
  listClassGroups,
  listAttendanceSummaryForClassPeriod,
} from "../agenda/agenda";
import { createBrowserClient } from "@supabase/ssr";

// ─── Design tokens ────────────────────────────────────────────────────────────
const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

// ─── Periods ─────────────────────────────────────────────────────────────────
const currentYear = new Date().getFullYear();
const schoolYearStart = new Date().getMonth() < 7 ? currentYear - 1 : currentYear;
const nextYear = schoolYearStart + 1;

const PERIODS = [
  { id: "T1", label: "T1 — Sept–Déc", from: `${schoolYearStart}-09-01`, to: `${schoolYearStart}-12-31` },
  { id: "T2", label: "T2 — Jan–Mars", from: `${nextYear}-01-01`, to: `${nextYear}-03-31` },
  { id: "T3", label: "T3 — Avr–Juin", from: `${nextYear}-04-01`, to: `${nextYear}-06-30` },
  { id: "all", label: "Toute l'année", from: `${schoolYearStart}-09-01`, to: `${nextYear}-06-30` },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && "message" in e) return (e as { message: string }).message;
  return String(e);
}

function formatDateFR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function rateColor(rate: number): string {
  if (rate >= 20) return "#dc2626";
  if (rate >= 10) return "#f59e0b";
  return "#16a34a";
}

// ─── Types ────────────────────────────────────────────────────────────────────
type AbsenceDetail = {
  student_id: UUID;
  date: string;
};

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(
  rows: AttendancePeriodSummaryRow[],
  details: AbsenceDetail[],
  className: string,
  periodLabel: string
) {
  const datesByStudent = new Map<UUID, string[]>();
  for (const d of details) {
    const arr = datesByStudent.get(d.student_id) ?? [];
    arr.push(formatDateFR(d.date));
    datesByStudent.set(d.student_id, arr);
  }

  const lines = [
    `Registre des absences — ${className} — ${periodLabel}`,
    "",
    "Nom;Prénom;Absences;Présences;Séances;Taux %;Dates d'absence",
    ...rows.map((r) => {
      const rate = r.total_marked > 0 ? ((r.absent_count / r.total_marked) * 100).toFixed(1) : "0.0";
      const dates = (datesByStudent.get(r.student_id) ?? []).join(" / ");
      return `${r.last_name};${r.first_name};${r.absent_count};${r.present_count};${r.total_marked};${rate}%;${dates}`;
    }),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `absences_${className.replace(/\s+/g, "_")}_${periodLabel.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AbsencesPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState<UUID | "">("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("T1");
  const [rows, setRows] = useState<AttendancePeriodSummaryRow[]>([]);
  const [details, setDetails] = useState<AbsenceDetail[]>([]);
  const [expandedId, setExpandedId] = useState<UUID | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootDone, setBootDone] = useState(false);

  // Boot
  useEffect(() => {
    (async () => {
      try {
        const c = await getTeacherContext();
        setCtx(c);
        const cl = await listClassGroups(c);
        setClasses(cl);
        if (cl.length > 0) setSelectedClass(cl[0].id);
      } catch (e) {
        setError(toNiceError(e));
      } finally {
        setBootDone(true);
      }
    })();
  }, []);

  // Load data when class or period changes
  const loadData = useCallback(async () => {
    if (!ctx || !selectedClass) return;
    const period = PERIODS.find((p) => p.id === selectedPeriod)!;
    setLoading(true);
    setError(null);
    setExpandedId(null);
    try {
      // Summary
      const summary = await listAttendanceSummaryForClassPeriod({
        ctx,
        classGroupId: selectedClass,
        dateFrom: period.from,
        dateTo: period.to,
      });
      // Sort by absent_count desc then name
      summary.sort((a, b) => {
        if (b.absent_count !== a.absent_count) return b.absent_count - a.absent_count;
        return (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name, "fr");
      });
      setRows(summary);

      // Detail: all absent records for the period
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await supabase
        .from("attendance_records")
        .select("student_id,date")
        .eq("school_id", ctx.schoolId)
        .eq("academic_year_id", ctx.academicYearId)
        .eq("teacher_id", ctx.teacherId)
        .eq("class_group_id", selectedClass)
        .eq("status", "absent")
        .gte("date", period.from)
        .lte("date", period.to)
        .order("date", { ascending: true });
      setDetails((data ?? []) as AbsenceDetail[]);
    } catch (e) {
      setError(toNiceError(e));
    } finally {
      setLoading(false);
    }
  }, [ctx, selectedClass, selectedPeriod]);

  useEffect(() => {
    if (bootDone && ctx && selectedClass) loadData();
  }, [bootDone, ctx, selectedClass, selectedPeriod, loadData]);

  const period = PERIODS.find((p) => p.id === selectedPeriod)!;
  const className = classes.find((c) => c.id === selectedClass)?.name ?? "";
  const totalAbsences = rows.reduce((s, r) => s + r.absent_count, 0);
  const totalSeances = rows.length > 0 ? (rows[0].total_marked > 0 ? rows[0].total_marked : 0) : 0;

  // Detail dates per student map
  const detailsByStudent = new Map<UUID, string[]>();
  for (const d of details) {
    const arr = detailsByStudent.get(d.student_id) ?? [];
    arr.push(d.date);
    detailsByStudent.set(d.student_id, arr);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FC" }}>
      {/* Header */}
      <div style={{ background: GRADIENT, padding: "28px 32px 24px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
              📋 Registre des absences
            </h1>
            {className && (
              <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.85 }}>
                {className} — {period.label}
              </p>
            )}
          </div>
          {rows.length > 0 && (
            <button
              onClick={() => exportCSV(rows, details, className, period.label)}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1.5px solid rgba(255,255,255,0.5)",
                borderRadius: 8,
                color: "#fff",
                padding: "8px 16px",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ⬇️ Exporter CSV
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 900, margin: "0 auto" }}>
        {/* Filters */}
        <div style={{
          background: "#fff",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Classe
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value as UUID)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#0f172a", background: "#fff" }}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Période
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriod(p.id)}
                  style={{
                    padding: "7px 13px",
                    borderRadius: 8,
                    border: "1.5px solid",
                    borderColor: selectedPeriod === p.id ? "#0A84FF" : "#e2e8f0",
                    background: selectedPeriod === p.id ? "rgba(10,132,255,0.08)" : "#fff",
                    color: selectedPeriod === p.id ? "#0A84FF" : "#475569",
                    fontWeight: selectedPeriod === p.id ? 700 : 500,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {p.id === "all" ? "Tout" : p.id}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 16, fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Stats */}
        {!loading && rows.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Élèves", value: rows.length, icon: "👥", color: "#0A84FF" },
              { label: "Total absences", value: totalAbsences, icon: "❌", color: "#dc2626" },
              { label: "Séances encodées", value: totalSeances, icon: "📅", color: "#7c3aed" },
              {
                label: "Taux moyen",
                value: rows.length > 0 && rows[0].total_marked > 0
                  ? `${((rows.reduce((s, r) => s + r.absent_count, 0) / rows.reduce((s, r) => s + r.total_marked, 0)) * 100).toFixed(1)}%`
                  : "—",
                icon: "📊",
                color: "#f59e0b"
              },
            ].map(({ label, value, icon, color }) => (
              <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{icon} {value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b", fontSize: 15 }}>
            Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: "48px 24px", textAlign: "center", color: "#64748b", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <p style={{ margin: 0, fontWeight: 600 }}>Aucune donnée de présence pour cette période.</p>
            <p style={{ margin: "6px 0 0", fontSize: 13 }}>Encode les présences depuis la page Agenda.</p>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {/* Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 80px 80px 80px 90px 24px",
              gap: 8,
              padding: "10px 20px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              fontSize: 11,
              fontWeight: 800,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}>
              <span>Élève</span>
              <span style={{ textAlign: "center" }}>Absences</span>
              <span style={{ textAlign: "center" }}>Présences</span>
              <span style={{ textAlign: "center" }}>Séances</span>
              <span style={{ textAlign: "center" }}>Taux</span>
              <span />
            </div>

            {rows.map((row, idx) => {
              const rate = row.total_marked > 0 ? (row.absent_count / row.total_marked) * 100 : 0;
              const isExpanded = expandedId === row.student_id;
              const absentDates = detailsByStudent.get(row.student_id) ?? [];

              return (
                <div key={row.student_id}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 80px 80px 80px 90px 24px",
                      gap: 8,
                      padding: "13px 20px",
                      borderBottom: idx < rows.length - 1 || isExpanded ? "1px solid #f1f5f9" : "none",
                      alignItems: "center",
                      cursor: row.absent_count > 0 ? "pointer" : "default",
                      background: isExpanded ? "#f8fafc" : "#fff",
                      transition: "background 0.1s",
                    }}
                    onClick={() => {
                      if (row.absent_count > 0) setExpandedId(isExpanded ? null : row.student_id);
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
                      {row.last_name} {row.first_name}
                    </span>
                    <span style={{ textAlign: "center" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 20,
                        background: row.absent_count > 0 ? "rgba(220,38,38,0.1)" : "rgba(22,163,74,0.08)",
                        color: row.absent_count > 0 ? "#dc2626" : "#16a34a",
                        fontWeight: 800,
                        fontSize: 13,
                      }}>
                        {row.absent_count}
                      </span>
                    </span>
                    <span style={{ textAlign: "center", fontWeight: 600, fontSize: 13, color: "#16a34a" }}>
                      {row.present_count}
                    </span>
                    <span style={{ textAlign: "center", fontWeight: 500, fontSize: 13, color: "#64748b" }}>
                      {row.total_marked}
                    </span>
                    <span style={{ textAlign: "center" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: `${rateColor(rate)}18`,
                        color: rateColor(rate),
                        fontWeight: 700,
                        fontSize: 12,
                      }}>
                        {rate.toFixed(1)}%
                      </span>
                    </span>
                    <span style={{ textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                      {row.absent_count > 0 ? (isExpanded ? "▲" : "▼") : ""}
                    </span>
                  </div>

                  {/* Expanded: dates */}
                  {isExpanded && (
                    <div style={{
                      padding: "10px 20px 14px 56px",
                      borderBottom: idx < rows.length - 1 ? "1px solid #f1f5f9" : "none",
                      background: "#f8fafc",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Dates d'absence
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {absentDates.map((date) => (
                          <span key={date} style={{
                            padding: "3px 10px",
                            borderRadius: 20,
                            background: "rgba(220,38,38,0.1)",
                            color: "#dc2626",
                            fontSize: 12,
                            fontWeight: 600,
                            border: "1px solid rgba(220,38,38,0.2)",
                          }}>
                            {formatDateFR(date)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        {!loading && rows.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
            <span>🟢 Taux &lt; 10%</span>
            <span>🟡 10–20%</span>
            <span>🔴 &gt; 20%</span>
            <span style={{ marginLeft: "auto" }}>Cliquer sur une ligne pour voir les dates</span>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EleveDashboardDrawer from "@/components/eleve/EleveDashboardDrawer";

import {
  type UUID,
  type Level,
  type TeacherContext,
  type ClassGroup,
  type Student,
  type Assessment,
  type Resultat,
  type CsvStudentImportRow,
  type CsvStudentImportSummary,
  getTeacherContext,
  listClassGroups,
  upsertClassGroup,
  deleteClassGroup,
  listStudentsInClass,
  addStudentAndEnroll,
  importStudentsToClass,
  listAssessmentsForClass,
  upsertResult,
  listResultatsForStudent,
} from "../resultats/resultats";

const LEVELS: Level[] = ["NI", "I", "S", "B", "TB"];

const card: React.CSSProperties = {
  borderRadius: 22,
  padding: 16,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow-soft)",
};

const input: React.CSSProperties = {
  minHeight: 46,
  padding: "11px 13px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.96)",
  color: "var(--text)",
  width: "100%",
};

const btn: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.96)",
  color: "var(--text)",
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "var(--shadow-card)",
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "var(--primary)",
  borderColor: "var(--primary)",
  color: "#fff",
  boxShadow: "0 12px 24px rgba(79,124,255,0.28)",
};

const studentLink: React.CSSProperties = {
  color: "var(--primary)",
  textDecoration: "none",
  fontWeight: 800,
};

function errorMessage(err: unknown): string {
  if (!err) return "Erreur inconnue";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null) {
    if ("message" in err && typeof err.message === "string" && err.message) return err.message;
    if ("error_description" in err && typeof err.error_description === "string" && err.error_description) {
      return err.error_description;
    }
  }
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

function isRlsDenied(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as any;
  const code = String(anyErr?.code ?? "");
  const message = String(anyErr?.message ?? "").toLowerCase();
  return code === "42501" || message.includes("row-level security") || message.includes("permission denied");
}

function splitCsvLine(line: string, delimiter: "," | ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function countDelimiter(line: string, delimiter: "," | ";"): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') i += 1;
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) count += 1;
  }
  return count;
}

function normalizeHeaderCell(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[ -]+/g, "_");
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseStudentsCsv(text: string): CsvStudentImportRow[] {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r\n|\n|\r/);
  const headerIndex = lines.findIndex((l) => l.trim().length > 0);
  if (headerIndex < 0) throw new Error("CSV vide.");

  const headerLine = lines[headerIndex];
  const delimiter: "," | ";" = countDelimiter(headerLine, ";") > countDelimiter(headerLine, ",") ? ";" : ",";
  const headers = splitCsvLine(headerLine, delimiter).map(normalizeHeaderCell);
  const idxFirst = findHeaderIndex(headers, ["first_name", "prenom", "first", "firstname"]);
  const idxLast = findHeaderIndex(headers, ["last_name", "nom", "last", "lastname"]);
  const idxRef = findHeaderIndex(headers, ["student_ref", "ordre", "num", "id_externe", "student_id", "external_id"]);
  const idxEmail = findHeaderIndex(headers, ["email_ecole", "email"]);

  if (idxFirst < 0 || idxLast < 0) {
    throw new Error("Colonnes requises manquantes. Attendu: prenom/first_name + nom/last_name.");
  }

  const rows: CsvStudentImportRow[] = [];
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    const cols = splitCsvLine(line, delimiter);
    rows.push({
      line: i + 1,
      first_name: (cols[idxFirst] ?? "").trim(),
      last_name: (cols[idxLast] ?? "").trim(),
      student_ref: idxRef >= 0 ? ((cols[idxRef] ?? "").trim() || null) : null,
      email: idxEmail >= 0 ? ((cols[idxEmail] ?? "").trim() || null) : null,
    });
  }

  return rows;
}

type StudentMeta = { student_ref: string | null; email: string | null };

export default function TeacherCotationView() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classCounts, setClassCounts] = useState<Record<UUID, number>>({});
  const [classId, setClassId] = useState<UUID | "">("");
  const [addStudentClassId, setAddStudentClassId] = useState<UUID | "">("");

  const [students, setStudents] = useState<Student[]>([]);
  const [studentMetaById, setStudentMetaById] = useState<Record<UUID, StudentMeta>>({});
  const [studentId, setStudentId] = useState<UUID | "">("");

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState<UUID | "">("");

  const [results, setResults] = useState<Resultat[]>([]);

  const [newClassName, setNewClassName] = useState("");
  const [newClassGrade, setNewClassGrade] = useState<number>(1);
  const [newStudentFirst, setNewStudentFirst] = useState("");
  const [newStudentLast, setNewStudentLast] = useState("");
  const [importPanelOpen, setImportPanelOpen] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvRows, setCsvRows] = useState<CsvStudentImportRow[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvSummary, setCsvSummary] = useState<CsvStudentImportSummary | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [classModalOpen, setClassModalOpen] = useState(false);
  const [selectedEleveId, setSelectedEleveId] = useState<UUID | null>(null);

  const [valueInput, setValueInput] = useState("");
  const [levelInput, setLevelInput] = useState<Level | "">("");

  const canSaveResult = useMemo(() => {
    if (!ctx || !studentId || !assessmentId) return false;
    return valueInput.trim() !== "" || levelInput !== "";
  }, [ctx, studentId, assessmentId, valueInput, levelInput]);

  const csvPreviewRows = useMemo(() => csvRows.slice(0, 10), [csvRows]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) ?? null,
    [classes, classId]
  );

  const sortedClasses = useMemo(
    () =>
      [...classes].sort((a, b) => {
        const ga = a.grade_level ?? Number.MAX_SAFE_INTEGER;
        const gb = b.grade_level ?? Number.MAX_SAFE_INTEGER;
        if (ga !== gb) return ga - gb;
        return a.name.localeCompare(b.name, "fr");
      }),
    [classes]
  );

  async function reloadClassCounts(c: TeacherContext): Promise<Record<UUID, number>> {
    const { data, error } = await c.supabase
      .from("student_enrollments")
      .select("class_group_id")
      .eq("school_id", c.schoolId)
      .eq("academic_year_id", c.academicYearId);

    if (error) throw error;

    const counts: Record<UUID, number> = {};
    for (const row of (data ?? []) as Array<{ class_group_id: UUID | null }>) {
      if (!row.class_group_id) continue;
      counts[row.class_group_id] = (counts[row.class_group_id] ?? 0) + 1;
    }
    return counts;
  }

  async function loadStudentMeta(c: TeacherContext, rows: Student[]) {
    const ids = rows.map((s) => s.id);
    if (ids.length === 0) {
      setStudentMetaById({});
      return;
    }

    try {
      let data: Array<{ id: UUID; student_ref?: string | null; email?: string | null }> | null = null;
      let queryError: unknown = null;

      const withEmail = await c.supabase
        .from("students")
        .select("id,student_ref,email")
        .eq("school_id", c.schoolId)
        .in("id", ids);

      if (withEmail.error) {
        const fallback = await c.supabase
          .from("students")
          .select("id,student_ref")
          .eq("school_id", c.schoolId)
          .in("id", ids);
        if (fallback.error) {
          queryError = fallback.error;
        } else {
          data = (fallback.data ?? []) as Array<{ id: UUID; student_ref?: string | null }>;
        }
      } else {
        data = (withEmail.data ?? []) as Array<{ id: UUID; student_ref?: string | null; email?: string | null }>;
      }

      if (queryError) throw queryError;

      const next: Record<UUID, StudentMeta> = {};
      for (const row of data ?? []) {
        next[row.id] = { student_ref: row.student_ref ?? null, email: row.email ?? null };
      }
      for (const s of rows) {
        if (!next[s.id]) next[s.id] = { student_ref: null, email: null };
      }
      setStudentMetaById(next);
    } catch {
      const fallback: Record<UUID, StudentMeta> = {};
      for (const s of rows) fallback[s.id] = { student_ref: null, email: null };
      setStudentMetaById(fallback);
    }
  }

  async function boot() {
    try {
      setErr(null);
      setInfoMsg(null);
      const c = await getTeacherContext();
      setCtx(c);
      const cls = await listClassGroups(c);
      setClasses(cls);
      const counts = await reloadClassCounts(c);
      setClassCounts(counts);
      const first = cls[0]?.id ?? "";
      setClassId(first);
      setAddStudentClassId(first);
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function reloadClassData(c: TeacherContext, selectedClassId: UUID | "") {
    if (!selectedClassId) {
      setStudents([]);
      setStudentMetaById({});
      setAssessments([]);
      setStudentId("");
      setAssessmentId("");
      setResults([]);
      return;
    }

    const [stu, eva] = await Promise.all([
      listStudentsInClass(c, selectedClassId),
      listAssessmentsForClass(c, selectedClassId),
    ]);

    setStudents(stu);
    setAssessments(eva);
    await loadStudentMeta(c, stu);

    setStudentId((prev) => (prev && stu.some((s) => s.id === prev) ? prev : stu[0]?.id ?? ""));
    setAssessmentId((prev) => (prev && eva.some((a) => a.id === prev) ? prev : eva[0]?.id ?? ""));
  }

  async function reloadStudentResults(c: TeacherContext, selectedStudentId: UUID | "") {
    if (!selectedStudentId) {
      setResults([]);
      return;
    }
    const rows = await listResultatsForStudent(c, { studentId: selectedStudentId });
    setResults(rows);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void boot();
    });
  }, []);

  useEffect(() => {
    if (!ctx) return;
    queueMicrotask(() => {
      void reloadClassData(ctx, classId).catch((e: unknown) => setErr(errorMessage(e)));
    });
  }, [ctx, classId]);

  useEffect(() => {
    if (!ctx) return;
    queueMicrotask(() => {
      void reloadStudentResults(ctx, studentId).catch((e: unknown) => setErr(errorMessage(e)));
    });
  }, [ctx, studentId]);

  useEffect(() => {
    if (!classId) return;
    setAddStudentClassId(classId);
  }, [classId]);

  async function onCreateClass() {
    if (!ctx) return;
    try {
      setErr(null);
      setInfoMsg(null);
      const newId = await upsertClassGroup(ctx, { name: newClassName, grade_level: newClassGrade });
      const cls = await listClassGroups(ctx);
      setClasses(cls);
      setClassCounts(await reloadClassCounts(ctx));
      setClassId(newId);
      setAddStudentClassId(newId);
      setNewClassName("");
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function onDeleteClass() {
    if (!ctx || !classId) return;
    try {
      setErr(null);
      setInfoMsg(null);
      await deleteClassGroup(ctx, classId);
      const cls = await listClassGroups(ctx);
      setClasses(cls);
      setClassCounts(await reloadClassCounts(ctx));
      const nextId = cls[0]?.id ?? "";
      setClassId(nextId);
      setAddStudentClassId(nextId);
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function onAddStudent() {
    if (!ctx || !addStudentClassId) {
      setErr("Sélectionne une classe cible pour ajouter l'élève.");
      return;
    }
    try {
      setErr(null);
      setInfoMsg(null);
      await addStudentAndEnroll(ctx, {
        classGroupId: addStudentClassId,
        first_name: newStudentFirst,
        last_name: newStudentLast,
      });
      setNewStudentFirst("");
      setNewStudentLast("");
      setClassCounts(await reloadClassCounts(ctx));
      if (classId === addStudentClassId) {
        await reloadClassData(ctx, classId);
      }
      const cls = await listClassGroups(ctx);
      setClasses(cls);
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function onSelectCsv(file: File | null) {
    try {
      setErr(null);
      setInfoMsg(null);
      setCsvSummary(null);
      setCsvRows([]);
      setCsvFileName(file?.name ?? "");
      if (!file) return;
      const text = await file.text();
      const rows = parseStudentsCsv(text);
      setCsvRows(rows);
      setInfoMsg(`${rows.length} ligne(s) détectée(s).`);
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function onImportCsv() {
    if (!ctx) return;
    if (!classId) {
      setErr("Sélectionne une classe avant d'importer.");
      return;
    }
    if (csvRows.length === 0) {
      setErr("Aucune ligne CSV à importer.");
      return;
    }
    try {
      setErr(null);
      setInfoMsg(null);
      setCsvImporting(true);
      const summary = await importStudentsToClass(ctx, { classGroupId: classId, rows: csvRows });
      setCsvSummary(summary);

      let refreshedStudents: Student[] = [];
      try {
        refreshedStudents = await listStudentsInClass(ctx, classId);
      } catch (fetchErr: unknown) {
        if (isRlsDenied(fetchErr)) {
          setErr("RLS: SELECT interdit sur students/student_enrollments. Vérifie les policies Supabase.");
          return;
        }
        throw fetchErr;
      }

      setStudents(refreshedStudents);
      await loadStudentMeta(ctx, refreshedStudents);

      const cls = await listClassGroups(ctx);
      setClasses(cls);
      setClassCounts(await reloadClassCounts(ctx));

      setInfoMsg(
        `Import terminé ✅ Élèves créés: ${summary.studentsCreated}, existants: ${summary.studentsExisting}, inscriptions créées: ${summary.enrollmentsCreated}, existantes: ${summary.enrollmentsExisting}, relus: ${refreshedStudents.length}.`
      );
    } catch (e: unknown) {
      setErr(errorMessage(e));
    } finally {
      setCsvImporting(false);
    }
  }

  async function onSaveResult() {
    if (!ctx || !studentId || !assessmentId) return;
    try {
      setErr(null);
      const raw = valueInput.trim();
      const parsedValue = raw === "" ? null : Number(raw);
      if (raw !== "" && Number.isNaN(parsedValue)) {
        setErr("La note numérique est invalide.");
        return;
      }

      await upsertResult(ctx, {
        studentId,
        assessmentId,
        value: parsedValue,
        level: levelInput === "" ? null : levelInput,
      });

      // Notification parent (fire-and-forget)
      const currentAssessment = assessments.find((a) => a.id === assessmentId);
      fetch("/api/notify-parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          evaluationTitle: currentAssessment?.title ?? "",
          level: levelInput || null,
          value: parsedValue,
          maxPoints: currentAssessment?.max_points ?? null,
        }),
      }).catch(() => {/* silencieux */});

      await reloadStudentResults(ctx, studentId);
      setValueInput("");
      setLevelInput("");
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  function openEleveDashboard(studentUuid: UUID) {
    setClassModalOpen(false);
    setSelectedEleveId(studentUuid);
  }

  return (
    <div>
      {err && (
        <div style={{ ...card, marginBottom: 14 }}>
          <b>Erreur:</b> {err}
        </div>
      )}
      {infoMsg && (
        <div style={{ ...card, marginBottom: 14 }}>
          <b>{infoMsg}</b>
        </div>
      )}

      <div style={{ ...card, padding: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Actions rapides</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
          <div style={{ opacity: 0.8 }}>
            Classe active:{" "}
            <b>
              {selectedClass
                ? `${selectedClass.name}${selectedClass.grade_level ? ` (niveau ${selectedClass.grade_level})` : ""}`
                : "Aucune"}
            </b>
          </div>
          <button style={btn} disabled={!classId} onClick={onDeleteClass}>
            Supprimer classe
          </button>
        </div>

        <div style={{ height: 10 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 10 }}>
          <input
            style={input}
            placeholder="Nouvelle classe (ex: 3A)"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
          />
          <input
            style={input}
            type="number"
            min={1}
            max={12}
            value={String(newClassGrade)}
            onChange={(e) => setNewClassGrade(Number(e.target.value))}
          />
          <button style={btnPrimary} onClick={onCreateClass}>
            Ajouter classe
          </button>
        </div>

        <div style={{ height: 14 }} />

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 1fr auto", gap: 10 }}>
          <select
            style={input}
            value={addStudentClassId}
            onChange={(e) => setAddStudentClassId(e.target.value as UUID | "")}
          >
            <option value="">Classe cible</option>
            {sortedClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.grade_level ? ` (niveau ${c.grade_level})` : ""}
              </option>
            ))}
          </select>
          <input
            style={input}
            placeholder="Prénom élève"
            value={newStudentFirst}
            onChange={(e) => setNewStudentFirst(e.target.value)}
            disabled={!addStudentClassId}
          />
          <input
            style={input}
            placeholder="Nom élève"
            value={newStudentLast}
            onChange={(e) => setNewStudentLast(e.target.value)}
            disabled={!addStudentClassId}
          />
          <button style={btnPrimary} onClick={onAddStudent} disabled={!addStudentClassId}>
            Ajouter élève
          </button>
        </div>

        <div style={{ height: 12 }} />

        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => void onSelectCsv(e.target.files?.[0] ?? null)}
          disabled={!classId}
        />

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            style={btn}
            onClick={() => {
              if (!classId) {
                setErr("Sélectionne une classe avant d'importer.");
                return;
              }
              setImportPanelOpen(true);
              csvInputRef.current?.click();
            }}
          >
            Importer élèves (CSV)
          </button>
        </div>

        {importPanelOpen && (
          <>
            <div style={{ height: 10 }} />
            <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Import CSV pour la classe sélectionnée</div>
              <div style={{ opacity: 0.8, marginBottom: 8 }}>
                Colonnes supportées (FR/EN): <b>prenom/first_name</b>, <b>nom/last_name</b>, optionnel <b>ordre/num/student_ref/id_externe</b>,
                optionnel <b>email_ecole/email</b>. Séparateur accepté: <b>,</b> ou <b>;</b>.
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button style={btn} onClick={() => csvInputRef.current?.click()} disabled={!classId}>
                  Choisir un CSV
                </button>
                <button style={btnPrimary} onClick={onImportCsv} disabled={!classId || csvRows.length === 0 || csvImporting}>
                  {csvImporting ? "Import en cours..." : "Confirmer import"}
                </button>
                <button style={btn} onClick={() => setImportPanelOpen(false)}>
                  Fermer
                </button>
                <div style={{ opacity: 0.75, fontSize: 13 }}>
                  {csvFileName ? `Fichier: ${csvFileName}` : "Aucun fichier sélectionné."}
                </div>
              </div>

              <div style={{ height: 10 }} />
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Aperçu (10 premières lignes)</div>
              {csvPreviewRows.length === 0 ? (
                <div style={{ opacity: 0.75 }}>Aucune donnée.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Ligne</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Prénom</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Nom</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Réf élève</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreviewRows.map((r) => {
                        const invalid = !r.first_name.trim() || !r.last_name.trim();
                        return (
                          <tr key={r.line} style={invalid ? { background: "rgba(220,38,38,0.08)" } : undefined}>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>{r.line}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>{r.first_name || "—"}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>{r.last_name || "—"}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>{r.student_ref ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {csvSummary && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Bilan import</div>
                  <div>Lignes CSV: <b>{csvSummary.rowsTotal}</b></div>
                  <div>Lignes valides importées: <b>{csvSummary.rowsValid}</b></div>
                  <div>Lignes en erreur: <b>{csvSummary.errors.length}</b></div>
                  <div>Élèves créés: <b>{csvSummary.studentsCreated}</b></div>
                  <div>Élèves déjà existants: <b>{csvSummary.studentsExisting}</b></div>
                  <div>Inscriptions créées: <b>{csvSummary.enrollmentsCreated}</b></div>
                  <div>Inscriptions existantes: <b>{csvSummary.enrollmentsExisting}</b></div>

                  {csvSummary.errors.length > 0 && (
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {csvSummary.errors.slice(0, 20).map((e, idx) => (
                        <div
                          key={`${e.line}-${idx}`}
                          style={{ border: "1px solid rgba(220,38,38,0.35)", borderRadius: 8, padding: 8, background: "rgba(220,38,38,0.08)" }}
                        >
                          Ligne {e.line}: {e.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Classes</div>
        {sortedClasses.length === 0 ? (
          <div style={{ opacity: 0.75 }}>Aucune classe.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
            {sortedClasses.map((cls) => {
              const isActive = cls.id === classId;
              const studentCount = classCounts[cls.id] ?? 0;
              return (
                <button
                  key={cls.id}
                  style={{
                    borderRadius: 22,
                    minHeight: 180,
                    padding: 16,
                    border: isActive ? "2px solid rgba(79,124,255,0.75)" : "1px solid var(--border)",
                    boxShadow: isActive ? "0 16px 28px rgba(79,124,255,0.24)" : "var(--shadow-card)",
                    background: isActive ? "linear-gradient(180deg, rgba(79,124,255,0.13), rgba(155,123,255,0.08))" : "var(--surface)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
                  }}
                  onClick={() => {
                    setClassId(cls.id);
                    setClassModalOpen(true);
                  }}
                >
                  <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{cls.name}</div>
                  <div style={{ marginTop: 8, opacity: 0.78, fontWeight: 700 }}>
                    {cls.grade_level ? `Niveau ${cls.grade_level}` : "Niveau —"}
                  </div>
                  <div style={{ marginTop: 8, opacity: 0.9, fontSize: 13, fontWeight: 700 }}>
                    {studentCount} élève{studentCount > 1 ? "s" : ""}
                  </div>
                  {isActive && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "inline-flex",
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: "rgba(79,124,255,0.14)",
                        border: "1px solid rgba(79,124,255,0.35)",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      Sélectionnée
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Cotation</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <select style={input} value={studentId} onChange={(e) => setStudentId(e.target.value as UUID | "") }>
            <option value="">Choisir un élève</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.last_name} {s.first_name}
              </option>
            ))}
          </select>

          <select style={input} value={assessmentId} onChange={(e) => setAssessmentId(e.target.value as UUID | "") }>
            <option value="">Choisir une évaluation</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
                {a.max_points != null ? ` (${a.max_points} pts)` : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ height: 10 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
          <input
            style={input}
            placeholder="Note numérique (optionnel)"
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            inputMode="decimal"
          />
          <select style={input} value={levelInput} onChange={(e) => setLevelInput(e.target.value as Level | "") }>
            <option value="">Niveau (optionnel)</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button style={btnPrimary} onClick={onSaveResult} disabled={!canSaveResult}>
            Enregistrer
          </button>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Résultats élève</div>
        {results.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Aucun résultat pour cet élève.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {results.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>{r.assessments?.title ?? "Évaluation"}</div>
                  <div style={{ opacity: 0.75, marginTop: 2 }}>
                    Note: <b>{r.value ?? "—"}</b> · Niveau: <b>{r.level ?? "—"}</b>
                  </div>
                </div>
                <div style={{ opacity: 0.7 }}>
                  {r.assessments?.max_points != null ? `Max ${r.assessments.max_points}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {classModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.40)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setClassModalOpen(false)}
        >
          <div
            style={{
              width: "min(920px,96vw)",
              maxHeight: "85vh",
              overflow: "auto",
              background: "var(--surface)",
              borderRadius: 20,
              padding: 18,
              border: "1px solid var(--border)",
              boxShadow: "0 24px 56px rgba(15,23,42,0.30)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 24, fontWeight: 900 }}>
                Élèves — {selectedClass ? selectedClass.name : "Classe"}
              </div>
              <button style={btn} onClick={() => setClassModalOpen(false)}>
                Fermer
              </button>
            </div>

            <div style={{ marginTop: 10, opacity: 0.8 }}>
              {selectedClass?.grade_level ? `Niveau ${selectedClass.grade_level}` : "Niveau —"} · {students.length} élève
              {students.length > 1 ? "s" : ""}
            </div>

            <div style={{ marginTop: 12 }}>
              {students.length === 0 ? (
                <div style={{ opacity: 0.75 }}>Aucun élève dans cette classe.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Ordre</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Nom</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Prénom</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Email</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)" }}>Fiche</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => {
                        const meta = studentMetaById[student.id] ?? { student_ref: null, email: null };
                        return (
                          <tr key={student.id}>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                              {meta.student_ref || String(idx + 1)}
                            </td>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                              <button
                                type="button"
                                style={{
                                  ...studentLink,
                                  border: "none",
                                  background: "transparent",
                                  padding: 0,
                                  cursor: "pointer",
                                }}
                                onClick={() => openEleveDashboard(student.id)}
                              >
                                {student.last_name}
                              </button>
                            </td>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                              <button
                                type="button"
                                style={{
                                  ...studentLink,
                                  border: "none",
                                  background: "transparent",
                                  padding: 0,
                                  cursor: "pointer",
                                }}
                                onClick={() => openEleveDashboard(student.id)}
                              >
                                {student.first_name}
                              </button>
                            </td>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>{meta.email || "—"}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                              <button style={btn} onClick={() => openEleveDashboard(student.id)}>
                                Ouvrir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedEleveId && (
        <EleveDashboardDrawer eleveId={selectedEleveId} onClose={() => setSelectedEleveId(null)} />
      )}
    </div>
  );
}

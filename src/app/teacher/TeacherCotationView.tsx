"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type UUID,
  type Level,
  type TeacherContext,
  type ClassGroup,
  type Student,
  type Assessment,
  type Resultat,
  type AttendanceRecord,
  type AttendanceStatus,
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
  listStudentsForClasses,
  listAttendanceForDate,
  upsertAttendanceForClass,
} from "../resultats/resultats";
import { formatDateFR } from "@/lib/date";

const LEVELS: Level[] = ["NI", "I", "S", "B", "TB"];

const card: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "white",
  border: "1px solid rgba(0,0,0,0.10)",
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  width: "100%",
};

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "rgba(37,99,235,0.10)",
  borderColor: "rgba(37,99,235,0.25)",
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
  return (
    code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission denied")
  );
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
  const idxRef = findHeaderIndex(headers, ["student_ref", "ordre", "id_externe", "student_id", "external_id"]);
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

type AttendanceByClass = Record<UUID, Record<UUID, boolean>>;
type AttendanceFeedback = { type: "success" | "error"; text: string };

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createAttendanceSelection(
  studentsByClass: Record<UUID, Student[]>,
  records: AttendanceRecord[]
): AttendanceByClass {
  const out: AttendanceByClass = {};
  for (const [classId, students] of Object.entries(studentsByClass) as Array<[UUID, Student[]]>) {
    out[classId] = {};
    for (const student of students) out[classId][student.id] = false;
  }

  for (const row of records) {
    if (!out[row.class_group_id]) continue;
    out[row.class_group_id][row.student_id] = row.status === "absent";
  }
  return out;
}

export default function TeacherCotationView() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classId, setClassId] = useState<UUID | "">("");

  const [students, setStudents] = useState<Student[]>([]);
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

  const [valueInput, setValueInput] = useState("");
  const [levelInput, setLevelInput] = useState<Level | "">("");
  const [studentsByClass, setStudentsByClass] = useState<Record<UUID, Student[]>>({});
  const [attendanceByClass, setAttendanceByClass] = useState<AttendanceByClass>({});
  const [attendanceSaving, setAttendanceSaving] = useState<Record<UUID, boolean>>({});
  const [attendanceFeedback, setAttendanceFeedback] = useState<Record<UUID, AttendanceFeedback | null>>({});

  const today = useMemo(() => todayIsoDate(), []);
  const todayLabel = useMemo(() => formatDateFR(today), [today]);

  const canSaveResult = useMemo(() => {
    if (!ctx || !studentId || !assessmentId) return false;
    return valueInput.trim() !== "" || levelInput !== "";
  }, [ctx, studentId, assessmentId, valueInput, levelInput]);

  const csvPreviewRows = useMemo(() => csvRows.slice(0, 10), [csvRows]);

  async function boot() {
    try {
      setErr(null);
      setInfoMsg(null);
      const c = await getTeacherContext();
      setCtx(c);
      const cls = await listClassGroups(c);
      setClasses(cls);
      if (cls[0]?.id) setClassId(cls[0].id);
      await reloadAttendanceData(c, cls);
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function reloadClassData(c: TeacherContext, selectedClassId: UUID | "") {
    if (!selectedClassId) {
      setStudents([]);
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

  async function reloadAttendanceData(c: TeacherContext, classList: ClassGroup[]) {
    const classIds = classList.map((cg) => cg.id);
    if (classIds.length === 0) {
      setStudentsByClass({});
      setAttendanceByClass({});
      setAttendanceFeedback({});
      return;
    }

    const [studentsMap, attendanceRows] = await Promise.all([
      listStudentsForClasses(c, classIds),
      listAttendanceForDate(c, { date: today, classGroupIds: classIds }),
    ]);

    setStudentsByClass(studentsMap);
    setAttendanceByClass(createAttendanceSelection(studentsMap, attendanceRows));
    setAttendanceFeedback((prev) => {
      const next: Record<UUID, AttendanceFeedback | null> = {};
      for (const classId of classIds) next[classId] = prev[classId] ?? null;
      return next;
    });
  }

  function setAbsentForStudent(classGroupId: UUID, studentId: UUID, absent: boolean) {
    setAttendanceByClass((prev) => ({
      ...prev,
      [classGroupId]: {
        ...(prev[classGroupId] ?? {}),
        [studentId]: absent,
      },
    }));
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

  async function onCreateClass() {
    if (!ctx) return;
    try {
      setErr(null);
      setInfoMsg(null);
      const newId = await upsertClassGroup(ctx, { name: newClassName, grade_level: newClassGrade });
      const cls = await listClassGroups(ctx);
      setClasses(cls);
      setClassId(newId);
      setNewClassName("");
      await reloadAttendanceData(ctx, cls);
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
      setClassId(cls[0]?.id ?? "");
      await reloadAttendanceData(ctx, cls);
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function onAddStudent() {
    if (!ctx || !classId) return;
    try {
      setErr(null);
      setInfoMsg(null);
      await addStudentAndEnroll(ctx, {
        classGroupId: classId,
        first_name: newStudentFirst,
        last_name: newStudentLast,
      });
      setNewStudentFirst("");
      setNewStudentLast("");
      await reloadClassData(ctx, classId);
      const cls = await listClassGroups(ctx);
      setClasses(cls);
      await reloadAttendanceData(ctx, cls);
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
    if (!ctx || !classId) return;
    if (csvRows.length === 0) {
      setErr("Aucune ligne CSV à importer.");
      return;
    }
    try {
      setErr(null);
      setInfoMsg(null);
      setCsvImporting(true);
      console.log("[Import élèves] payload", {
        schoolId: ctx.schoolId,
        academicYearId: ctx.academicYearId,
        classGroupId: classId,
        rows: csvRows.length,
      });
      const summary = await importStudentsToClass(ctx, { classGroupId: classId, rows: csvRows });
      setCsvSummary(summary);
      let fetchedStudentsCount = 0;
      try {
        const refreshedStudents = await listStudentsInClass(ctx, classId);
        fetchedStudentsCount = refreshedStudents.length;
        setStudents(refreshedStudents);
      } catch (fetchErr: unknown) {
        if (isRlsDenied(fetchErr)) {
          setErr("RLS: SELECT interdit sur students/student_enrollments. Vérifie les policies Supabase.");
          return;
        }
        throw fetchErr;
      }
      const cls = await listClassGroups(ctx);
      setClasses(cls);
      await reloadAttendanceData(ctx, cls);
      console.log("[Import élèves] summary", {
        createdStudents: summary.studentsCreated,
        existingStudents: summary.studentsExisting,
        createdEnrollments: summary.enrollmentsCreated,
        existingEnrollments: summary.enrollmentsExisting,
        fetchedStudents: fetchedStudentsCount,
      });
      if (
        fetchedStudentsCount === 0 &&
        (summary.enrollmentsCreated > 0 || summary.enrollmentsExisting > 0)
      ) {
        setErr("Import DB OK mais aucun élève relu. RLS probable sur students/student_enrollments.");
      }
      setInfoMsg(
        `Import terminé ✅ Élèves créés: ${summary.studentsCreated}, existants: ${summary.studentsExisting}, inscriptions créées: ${summary.enrollmentsCreated}, existantes: ${summary.enrollmentsExisting}, relus: ${fetchedStudentsCount}. Diagnostic: school=${ctx.schoolId}, year=${ctx.academicYearId}, class=${classId}, rows=${csvRows.length}.`
      );
    } catch (e: unknown) {
      setErr(errorMessage(e));
    } finally {
      setCsvImporting(false);
    }
  }

  async function onSaveAttendance(classGroupId: UUID) {
    if (!ctx) return;
    const classStudents = studentsByClass[classGroupId] ?? [];
    if (classStudents.length === 0) {
      setAttendanceFeedback((prev) => ({
        ...prev,
        [classGroupId]: { type: "error", text: "Aucun élève dans cette classe." },
      }));
      return;
    }

    try {
      setAttendanceSaving((prev) => ({ ...prev, [classGroupId]: true }));
      setAttendanceFeedback((prev) => ({ ...prev, [classGroupId]: null }));

      const rows = classStudents.map((student) => {
        const absent = attendanceByClass[classGroupId]?.[student.id] ?? false;
        const status: AttendanceStatus = absent ? "absent" : "present";
        return { studentId: student.id, status };
      });

      await upsertAttendanceForClass(ctx, {
        classGroupId,
        date: today,
        rows,
      });

      const absentCount = rows.filter((r) => r.status === "absent").length;
      const presentCount = rows.length - absentCount;
      setAttendanceFeedback((prev) => ({
        ...prev,
        [classGroupId]: {
          type: "success",
          text: `Présence enregistrée ✅ (${presentCount} présents, ${absentCount} absents)`,
        },
      }));
    } catch (e: unknown) {
      setAttendanceFeedback((prev) => ({
        ...prev,
        [classGroupId]: {
          type: "error",
          text: errorMessage(e),
        },
      }));
    } finally {
      setAttendanceSaving((prev) => ({ ...prev, [classGroupId]: false }));
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

      await reloadStudentResults(ctx, studentId);
      setValueInput("");
      setLevelInput("");
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
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

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Actions rapides</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
          <select style={input} value={classId} onChange={(e) => setClassId(e.target.value as UUID | "")}>
            <option value="">Choisir une classe</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.grade_level ? ` (niveau ${c.grade_level})` : ""}
              </option>
            ))}
          </select>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
          <input
            style={input}
            placeholder="Prénom élève"
            value={newStudentFirst}
            onChange={(e) => setNewStudentFirst(e.target.value)}
            disabled={!classId}
          />
          <input
            style={input}
            placeholder="Nom élève"
            value={newStudentLast}
            onChange={(e) => setNewStudentLast(e.target.value)}
            disabled={!classId}
          />
          <button style={btnPrimary} onClick={onAddStudent} disabled={!classId}>
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
              setImportPanelOpen(true);
              csvInputRef.current?.click();
            }}
            disabled={!classId}
          >
            Importer
          </button>
          <a
            href="/templates/modele_import_eleves.csv"
            target="_blank"
            rel="noopener noreferrer"
            download
            style={{ ...btn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Télécharger modèle CSV
          </a>
        </div>

        {importPanelOpen && (
          <>
            <div style={{ height: 10 }} />
            <div style={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Import CSV pour la classe sélectionnée</div>
              <div style={{ opacity: 0.8, marginBottom: 8 }}>
                Colonnes supportées (FR/EN): <b>prenom/first_name</b>, <b>nom/last_name</b>, optionnel <b>ordre/student_ref/id_externe</b>,
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
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Ligne</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Prénom</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Nom</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Réf élève</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreviewRows.map((r) => {
                        const invalid = !r.first_name.trim() || !r.last_name.trim();
                        return (
                          <tr key={r.line} style={invalid ? { background: "rgba(220,38,38,0.08)" } : undefined}>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.line}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.first_name || "—"}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.last_name || "—"}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.student_ref ?? "—"}</td>
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

      <div style={{ display: "grid", gap: 14 }}>
        {classes.map((cls) => {
          const classStudents = studentsByClass[cls.id] ?? [];
          const feedback = attendanceFeedback[cls.id];
          const isSaving = attendanceSaving[cls.id] ?? false;
          return (
            <div key={cls.id} style={card}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                {cls.name}
                {cls.grade_level ? ` - niveau ${cls.grade_level}` : ""}
              </div>
              <div style={{ opacity: 0.8, marginTop: 4, marginBottom: 10 }}>
                {todayLabel} - Présences du jour
              </div>

              {classStudents.length === 0 ? (
                <div style={{ opacity: 0.72 }}>Aucun élève dans cette classe.</div>
              ) : (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Nom</th>
                          <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Prénom</th>
                          <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Absence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((student) => {
                          const absent = attendanceByClass[cls.id]?.[student.id] ?? false;
                          return (
                            <tr key={student.id}>
                              <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{student.last_name}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{student.first_name}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={absent}
                                  onChange={(e) => setAbsentForStudent(cls.id, student.id, e.target.checked)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button style={btnPrimary} onClick={() => void onSaveAttendance(cls.id)} disabled={isSaving}>
                      {isSaving ? "Enregistrement..." : "Enregistrer la présence"}
                    </button>
                    {feedback && (
                      <div
                        style={{
                          fontWeight: 700,
                          color: feedback.type === "success" ? "#166534" : "#b91c1c",
                        }}
                      >
                        {feedback.type === "error" ? `Erreur: ${feedback.text}` : feedback.text}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Cotation</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <select style={input} value={studentId} onChange={(e) => setStudentId(e.target.value as UUID | "")}>
            <option value="">Choisir un élève</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.last_name} {s.first_name}
              </option>
            ))}
          </select>

          <select style={input} value={assessmentId} onChange={(e) => setAssessmentId(e.target.value as UUID | "")}>
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
          <select style={input} value={levelInput} onChange={(e) => setLevelInput(e.target.value as Level | "")}>
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
                  border: "1px solid rgba(0,0,0,0.10)",
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
    </div>
  );
}

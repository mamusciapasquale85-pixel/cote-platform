"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateFR } from "@/lib/date";
import {
  type UUID as StudentUUID,
  type TeacherContext as StudentCtx,
  type ClassGroup as StudentClass,
  type CsvStudentImportRow,
  type CsvStudentImportSummary,
  getTeacherContext as getStudentContext,
  listClassGroups as listStudentClasses,
  importStudentsToClass,
  listStudentsInClass,
} from "../resultats/resultats";
import {
  type TeacherContext as EvalCtx,
  type ClassGroup as EvalClass,
  type Course,
  type Apprentissage,
  type ParsedAssessmentCsvRow,
  type AssessmentCsvImportSummary,
  parseAssessmentsCsv,
  getTeacherContext as getEvalContext,
  listClassGroups as listEvalClasses,
  listCourses,
  listApprentissages,
  importAssessmentsCsv,
} from "../evaluations/evaluations";
import {
  type TeacherContext as AgendaCtx,
  type ClassGroup as AgendaClass,
  type ParsedScheduleCsvRow,
  type ScheduleImportSummary,
  parseScheduleCsv,
  getTeacherContext as getAgendaContext,
  listClassGroups as listAgendaClasses,
  importTeacherScheduleCsv,
  normalizeSlotLabel,
} from "../agenda/agenda";

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    if ("message" in e && typeof e.message === "string" && e.message) return e.message;
    if ("error_description" in e && typeof e.error_description === "string" && e.error_description) {
      return e.error_description;
    }
  }
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
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

const TYPE_LABEL: Record<string, string> = {
  summative: "Sommative",
  formative: "Formative",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  published: "Publiée",
  archived: "Archivée",
};

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

export default function ImportPage() {
  const [pageError, setPageError] = useState<string | null>(null);

  const [studentCtx, setStudentCtx] = useState<StudentCtx | null>(null);
  const [studentClasses, setStudentClasses] = useState<StudentClass[]>([]);
  const [studentClassId, setStudentClassId] = useState<StudentUUID | "">("");
  const [studentRows, setStudentRows] = useState<CsvStudentImportRow[]>([]);
  const [studentFileName, setStudentFileName] = useState("");
  const [studentSummary, setStudentSummary] = useState<CsvStudentImportSummary | null>(null);
  const [studentInfo, setStudentInfo] = useState<string | null>(null);
  const [studentImporting, setStudentImporting] = useState(false);

  const [evalCtx, setEvalCtx] = useState<EvalCtx | null>(null);
  const [evalClasses, setEvalClasses] = useState<EvalClass[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [apprentissages, setApprentissages] = useState<Apprentissage[]>([]);
  const [evalRows, setEvalRows] = useState<ParsedAssessmentCsvRow[]>([]);
  const [evalFileName, setEvalFileName] = useState("");
  const [evalSummary, setEvalSummary] = useState<AssessmentCsvImportSummary | null>(null);
  const [evalInfo, setEvalInfo] = useState<string | null>(null);
  const [evalImporting, setEvalImporting] = useState(false);

  const [agendaCtx, setAgendaCtx] = useState<AgendaCtx | null>(null);
  const [agendaClasses, setAgendaClasses] = useState<AgendaClass[]>([]);
  const [agendaRows, setAgendaRows] = useState<ParsedScheduleCsvRow[]>([]);
  const [agendaFileName, setAgendaFileName] = useState("");
  const [agendaSummary, setAgendaSummary] = useState<ScheduleImportSummary | null>(null);
  const [agendaInfo, setAgendaInfo] = useState<string | null>(null);
  const [agendaImporting, setAgendaImporting] = useState(false);

  const studentInputRef = useRef<HTMLInputElement | null>(null);
  const evalInputRef = useRef<HTMLInputElement | null>(null);
  const agendaInputRef = useRef<HTMLInputElement | null>(null);

  const studentPreview = useMemo(() => studentRows.slice(0, 10), [studentRows]);
  const evalPreview = useMemo(() => evalRows.slice(0, 10), [evalRows]);
  const agendaPreview = useMemo(() => agendaRows.slice(0, 10), [agendaRows]);

  useEffect(() => {
    (async () => {
      try {
        setPageError(null);

        const [sCtx, eCtx, aCtx] = await Promise.all([
          getStudentContext(),
          getEvalContext(),
          getAgendaContext(),
        ]);

        setStudentCtx(sCtx);
        setEvalCtx(eCtx);
        setAgendaCtx(aCtx);

        const [sClasses, eClasses, eCourses, eApps, aClasses] = await Promise.all([
          listStudentClasses(sCtx),
          listEvalClasses(eCtx),
          listCourses(eCtx),
          listApprentissages(eCtx),
          listAgendaClasses(aCtx),
        ]);

        setStudentClasses(sClasses);
        setStudentClassId(sClasses[0]?.id ?? "");
        setEvalClasses(eClasses);
        setCourses(eCourses);
        setApprentissages(eApps);
        setAgendaClasses(aClasses);
      } catch (e: unknown) {
        setPageError(toNiceError(e));
      }
    })();
  }, []);

  async function onSelectStudentFile(file: File | null) {
    try {
      setPageError(null);
      setStudentSummary(null);
      setStudentInfo(null);
      setStudentRows([]);
      setStudentFileName(file?.name ?? "");
      if (!file) return;
      const text = await file.text();
      const parsed = parseStudentsCsv(text);
      setStudentRows(parsed);
      setStudentInfo(`${parsed.length} ligne(s) détectée(s).`);
    } catch (e: unknown) {
      setPageError(toNiceError(e));
    }
  }

  async function onImportStudents() {
    if (!studentCtx || !studentClassId) return;
    if (studentRows.length === 0) {
      setPageError("Aucune ligne CSV à importer.");
      return;
    }

    try {
      setPageError(null);
      setStudentInfo(null);
      setStudentImporting(true);
      const summary = await importStudentsToClass(studentCtx, {
        classGroupId: studentClassId,
        rows: studentRows,
      });
      setStudentSummary(summary);
      const updatedStudents = await listStudentsInClass(studentCtx, studentClassId);
      setStudentInfo(
        `Import élèves terminé ✅ ${summary.studentsCreated} créés, ${summary.studentsExisting} existants, ${summary.errors.length} erreurs. Classe: ${updatedStudents.length} élèves inscrits.`
      );
    } catch (e: unknown) {
      setPageError(toNiceError(e));
    } finally {
      setStudentImporting(false);
    }
  }

  async function onSelectEvalFile(file: File | null) {
    try {
      setPageError(null);
      setEvalSummary(null);
      setEvalInfo(null);
      setEvalRows([]);
      setEvalFileName(file?.name ?? "");
      if (!file) return;
      const text = await file.text();
      const parsed = parseAssessmentsCsv(text);
      setEvalRows(parsed);
      setEvalInfo(`${parsed.length} ligne(s) détectée(s).`);
    } catch (e: unknown) {
      setPageError(toNiceError(e));
    }
  }

  async function onImportEval() {
    if (!evalCtx) return;
    if (evalRows.length === 0) {
      setPageError("Aucune ligne CSV à importer.");
      return;
    }

    try {
      setPageError(null);
      setEvalInfo(null);
      setEvalImporting(true);
      const summary = await importAssessmentsCsv({
        ctx: evalCtx,
        rows: evalRows,
        classes: evalClasses,
        courses,
        apprentissages,
      });
      setEvalSummary(summary);
      setEvalInfo(`Import évaluations terminé ✅ ${summary.created} créées, ${summary.alreadyExisting} déjà existantes, ${summary.errors.length} erreurs.`);
    } catch (e: unknown) {
      setPageError(toNiceError(e));
    } finally {
      setEvalImporting(false);
    }
  }

  async function onSelectAgendaFile(file: File | null) {
    try {
      setPageError(null);
      setAgendaSummary(null);
      setAgendaInfo(null);
      setAgendaRows([]);
      setAgendaFileName(file?.name ?? "");
      if (!file) return;
      const text = await file.text();
      const parsed = parseScheduleCsv(text);
      setAgendaRows(parsed);
      setAgendaInfo(`${parsed.length} ligne(s) détectée(s).`);
    } catch (e: unknown) {
      setPageError(toNiceError(e));
    }
  }

  async function onImportAgenda() {
    if (!agendaCtx) return;
    if (agendaRows.length === 0) {
      setPageError("Aucune ligne CSV à importer.");
      return;
    }

    try {
      setPageError(null);
      setAgendaInfo(null);
      setAgendaImporting(true);
      const summary = await importTeacherScheduleCsv({
        ctx: agendaCtx,
        rows: agendaRows,
        classes: agendaClasses,
      });
      setAgendaSummary(summary);
      setAgendaInfo(
        `Import horaires terminé ✅ ${summary.created} créés, ${summary.updated} mis à jour, ${summary.errors.length} erreurs. Slots ${summary.minSlot ?? "—"}-${summary.maxSlot ?? "—"}.`
      );
    } catch (e: unknown) {
      setPageError(toNiceError(e));
    } finally {
      setAgendaImporting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {pageError && (
        <div style={card}>
          <b>Erreur :</b> {pageError}
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Import Élèves (par classe)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
          <select style={input} value={studentClassId} onChange={(e) => setStudentClassId(e.target.value as StudentUUID | "") }>
            <option value="">Choisir une classe</option>
            {studentClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.grade_level ? ` (niveau ${c.grade_level})` : ""}
              </option>
            ))}
          </select>
          <button style={btn} onClick={() => studentInputRef.current?.click()} disabled={!studentCtx || !studentClassId}>Choisir fichier</button>
          <button style={btnPrimary} onClick={onImportStudents} disabled={!studentCtx || !studentClassId || studentRows.length === 0 || studentImporting}>
            {studentImporting ? "Import..." : "Importer"}
          </button>
        </div>
        <input ref={studentInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => void onSelectStudentFile(e.target.files?.[0] ?? null)} />
        <div style={{ marginTop: 8, opacity: 0.8 }}>{studentFileName ? `Fichier: ${studentFileName}` : "Aucun fichier sélectionné."}</div>
        {studentInfo && <div style={{ marginTop: 8, fontWeight: 700 }}>{studentInfo}</div>}

        {studentPreview.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Preview (10 lignes)</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Ligne</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Prénom</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Nom</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Réf</th>
                  </tr>
                </thead>
                <tbody>
                  {studentPreview.map((r) => (
                    <tr key={r.line}>
                      <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.line}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.first_name || "—"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.last_name || "—"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.student_ref ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {studentSummary && (
          <div style={{ marginTop: 10 }}>
            <b>Log:</b> créés {studentSummary.studentsCreated}, existants {studentSummary.studentsExisting}, inscriptions créées {studentSummary.enrollmentsCreated}, inscriptions existantes {studentSummary.enrollmentsExisting}, erreurs {studentSummary.errors.length}.
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Import Évaluations</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: 10, alignItems: "center", justifyContent: "start" }}>
          <button style={btn} onClick={() => evalInputRef.current?.click()} disabled={!evalCtx}>Choisir fichier</button>
          <button style={btnPrimary} onClick={onImportEval} disabled={!evalCtx || evalRows.length === 0 || evalImporting}>
            {evalImporting ? "Import..." : "Importer"}
          </button>
        </div>
        <input ref={evalInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => void onSelectEvalFile(e.target.files?.[0] ?? null)} />
        <div style={{ marginTop: 8, opacity: 0.8 }}>{evalFileName ? `Fichier: ${evalFileName}` : "Aucun fichier sélectionné."}</div>
        {evalInfo && <div style={{ marginTop: 8, fontWeight: 700 }}>{evalInfo}</div>}

        {evalPreview.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Preview (10 lignes)</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Ligne</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Titre</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Date</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Type</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {evalPreview.map((r) => (
                    <tr key={r.line}>
                      <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.line}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.title || "—"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.date ? formatDateFR(r.date) : "—"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{TYPE_LABEL[(r.type_raw || "summative").toLowerCase()] ?? r.type_raw ?? "—"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{STATUS_LABEL[(r.status_raw || "draft").toLowerCase()] ?? r.status_raw ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {evalSummary && (
          <div style={{ marginTop: 10 }}>
            <b>Log:</b> créées {evalSummary.created}, ignorées {evalSummary.alreadyExisting}, erreurs {evalSummary.errors.length}.
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Import Horaire PROF</div>
        <div style={{ marginBottom: 10, opacity: 0.8 }}>slot: P1..P10 (ou 1..10 accepté)</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: 10, alignItems: "center", justifyContent: "start" }}>
          <button style={btn} onClick={() => agendaInputRef.current?.click()} disabled={!agendaCtx}>Choisir fichier</button>
          <button style={btnPrimary} onClick={onImportAgenda} disabled={!agendaCtx || agendaRows.length === 0 || agendaImporting}>
            {agendaImporting ? "Import..." : "Importer"}
          </button>
        </div>
        <input ref={agendaInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => void onSelectAgendaFile(e.target.files?.[0] ?? null)} />
        <div style={{ marginTop: 8, opacity: 0.8 }}>{agendaFileName ? `Fichier: ${agendaFileName}` : "Aucun fichier sélectionné."}</div>
        {agendaInfo && <div style={{ marginTop: 8, fontWeight: 700 }}>{agendaInfo}</div>}

        {agendaPreview.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Preview (10 lignes)</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Ligne</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Date</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Slot</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Classe</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Cours</th>
                  </tr>
                </thead>
                <tbody>
                  {agendaPreview.map((r) => {
                    const normalizedSlot = r.slot_label || normalizeSlotLabel(r.slot_raw);
                    const validSlot = !!normalizedSlot;
                    return (
                      <tr key={r.line} style={!validSlot ? { background: "rgba(220,38,38,0.08)" } : undefined}>
                        <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.line}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.date ? formatDateFR(r.date) : "—"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{normalizedSlot || r.slot_raw || "—"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.class_ref || "—"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.course_name_raw || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {agendaSummary && (
          <div style={{ marginTop: 10 }}>
            <b>Log:</b> créés {agendaSummary.created}, mis à jour {agendaSummary.updated}, erreurs {agendaSummary.errors.length}, période {agendaSummary.minDate ? formatDateFR(agendaSummary.minDate) : "—"} → {agendaSummary.maxDate ? formatDateFR(agendaSummary.maxDate) : "—"}.
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>QA manuel rapide</div>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Importer un CSV dans chaque bloc puis vérifier le log “créés / ignorés / erreurs”.</li>
          <li>Ouvrir /teacher, /evaluations et /agenda pour confirmer que les données importées sont visibles.</li>
          <li>Vérifier qu’aucune erreur “[object Object]” n’apparaît dans les messages UI.</li>
        </ol>
      </div>
    </div>
  );
}

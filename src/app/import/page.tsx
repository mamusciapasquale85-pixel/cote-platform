"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type UUID,
  type TeacherContext,
  type ClassGroup,
  type StudentOption,
  type ParsedStudentCsvRow,
  type StudentImportSummary,
  getTeacherContext,
  listClassGroups,
  listStudentsInClass,
  parseStudentsCsv,
  importStudentsToClass,
} from "./import";

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
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classId, setClassId] = useState<UUID | "">("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState<UUID | "">("");

  const [csvFileName, setCsvFileName] = useState("");
  const [rows, setRows] = useState<ParsedStudentCsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<StudentImportSummary | null>(null);

  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);
  const previewStats = useMemo(() => {
    const total = rows.length;
    const valid = rows.filter((r) => r.first_name.trim() && r.last_name.trim()).length;
    return {
      total,
      valid,
      errors: total - valid,
    };
  }, [rows]);

  useEffect(() => {
    (async () => {
      try {
        setErrorMsg(null);
        setInfoMsg(null);
        const c = await getTeacherContext();
        setCtx(c);

        const cls = await listClassGroups(c);
        setClasses(cls);
        setClassId(cls[0]?.id ?? "");
      } catch (e: unknown) {
        setErrorMsg(toNiceError(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!ctx || !classId) {
      setStudents([]);
      setStudentId("");
      return;
    }

    (async () => {
      try {
        const list = await listStudentsInClass(ctx, classId);
        setStudents(list);
        setStudentId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0]?.id ?? ""));
      } catch (e: unknown) {
        setErrorMsg(toNiceError(e));
      }
    })();
  }, [ctx, classId]);

  async function onCsvSelected(file: File | null) {
    try {
      setErrorMsg(null);
      setInfoMsg(null);
      setSummary(null);
      setRows([]);
      setCsvFileName(file?.name ?? "");

      if (!file) return;
      const text = await file.text();
      const parsed = parseStudentsCsv(text);
      setRows(parsed);
      setInfoMsg(`${parsed.length} ligne(s) détectée(s).`);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function onImport() {
    if (!ctx || !classId) return;
    if (rows.length === 0) {
      setErrorMsg("Aucune ligne CSV à importer.");
      return;
    }

    try {
      setErrorMsg(null);
      setInfoMsg(null);
      setSummary(null);
      setImporting(true);

      const result = await importStudentsToClass({
        ctx,
        classGroupId: classId,
        rows,
      });
      setSummary(result);
      setInfoMsg("Import terminé.");

      const updated = await listStudentsInClass(ctx, classId);
      setStudents(updated);
      setStudentId((prev) => (prev && updated.some((s) => s.id === prev) ? prev : updated[0]?.id ?? ""));
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    } finally {
      setImporting(false);
    }
  }

  async function onGeneratePdf() {
    if (!studentId) {
      setErrorMsg("Choisis un élève pour générer le bulletin PDF.");
      return;
    }

    try {
      setErrorMsg(null);
      setInfoMsg(null);
      const resp = await fetch(`/api/pdf/bulletin?student_id=${encodeURIComponent(studentId)}`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `Erreur HTTP ${resp.status}`);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const student = students.find((s) => s.id === studentId);
      const filename = student
        ? `bulletin-${student.last_name}-${student.first_name}.pdf`.replace(/\s+/g, "-")
        : "bulletin.pdf";

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setInfoMsg("PDF bulletin généré.");
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  const canImport = !!ctx && !!classId && rows.length > 0 && !importing;

  return (
    <div>
      {errorMsg && (
        <div style={{ ...card, marginBottom: 14 }}>
          <b>Erreur :</b> {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div style={{ ...card, marginBottom: 14 }}>
          <b>{infoMsg}</b>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Importer élèves (CSV par classe)</div>
        <div style={{ opacity: 0.8, marginBottom: 12 }}>
          CSV attendu: <b>first_name,last_name</b> (ou <b>Prénom,Nom</b>). Optionnel: <b>student_ref</b>. Séparateur accepté:
          <b> , </b>ou<b> ;</b>
        </div>
        <div style={{ opacity: 0.8, marginBottom: 12 }}>
          Déduplication: priorité <b>student_ref</b> si fourni, sinon <b>prénom+nom</b> (insensible à la casse).
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <select style={input} value={classId} onChange={(e) => setClassId(e.target.value as UUID | "")}> 
            <option value="">Choisir une classe cible</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.grade_level ? ` (niveau ${c.grade_level})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ height: 10 }} />

        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => void onCsvSelected(e.target.files?.[0] ?? null)}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button style={btn} onClick={() => csvInputRef.current?.click()} disabled={!ctx || !classId}>
            Importer élèves (CSV)
          </button>
          <button style={btnPrimary} onClick={onImport} disabled={!canImport}>
            {importing ? "Import en cours..." : "Confirmer import"}
          </button>
          <a
            href="/templates/modele_import_eleves.xlsx"
            target="_blank"
            rel="noopener noreferrer"
            download
            style={{ ...btn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Télécharger modèle élèves (Sheets)
          </a>
          <a
            href="/templates/modele_import_eleves.csv"
            target="_blank"
            rel="noopener noreferrer"
            download
            style={{ ...btn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Télécharger modèle élèves (CSV)
          </a>
          <a
            href="/samples/import-classe-example.csv"
            download
            style={{ ...btn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Exemple CSV
          </a>
          <div style={{ opacity: 0.75, fontSize: 13 }}>{csvFileName ? `Fichier: ${csvFileName}` : "Aucun fichier sélectionné."}</div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Preview (10 premières lignes)</div>
        <div style={{ marginBottom: 8 }}>
          Lignes: <b>{previewStats.total}</b> · Valides: <b>{previewStats.valid}</b> · Erreurs: <b>{previewStats.errors}</b>
        </div>

        {previewRows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>Aucune ligne à prévisualiser.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid rgba(0,0,0,0.1)", padding: 8 }}>Ligne</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid rgba(0,0,0,0.1)", padding: 8 }}>Prénom</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid rgba(0,0,0,0.1)", padding: 8 }}>Nom</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid rgba(0,0,0,0.1)", padding: 8 }}>Réf élève</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => {
                  const invalid = !r.first_name.trim() || !r.last_name.trim();
                  return (
                    <tr key={r.line} style={invalid ? { background: "rgba(220,38,38,0.08)" } : undefined}>
                      <td style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", padding: 8 }}>{r.line}</td>
                      <td style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", padding: 8 }}>{r.first_name || "—"}</td>
                      <td style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", padding: 8 }}>{r.last_name || "—"}</td>
                      <td style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", padding: 8 }}>{r.student_ref ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {summary && (
        <>
          <div style={{ height: 14 }} />
          <div style={card}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Log final import</div>
            <div>Créés: <b>{summary.studentsCreated}</b></div>
            <div>Déjà existants: <b>{summary.studentsExisting}</b></div>
            <div>Inscriptions (upsert): <b>{summary.enrollmentsInsertedOrUpserted}</b></div>
            <div>Ignorés: <b>{summary.rowsSkipped}</b></div>
            <div>Erreurs: <b>{summary.errors.length}</b></div>

            <div style={{ marginTop: 10, fontWeight: 800 }}>Détail lignes</div>
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              {summary.logs.slice(0, 100).map((log, idx) => (
                <div key={`${log.line}-${idx}`} style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: 8 }}>
                  Ligne {log.line} — {log.first_name} {log.last_name}: {log.status}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Générer PDF bulletin (V1)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
          <select style={input} value={classId} onChange={(e) => setClassId(e.target.value as UUID | "")}> 
            <option value="">Choisir une classe</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.grade_level ? ` (niveau ${c.grade_level})` : ""}
              </option>
            ))}
          </select>

          <select style={input} value={studentId} onChange={(e) => setStudentId(e.target.value as UUID | "")}> 
            <option value="">Choisir un élève</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.last_name} {s.first_name}
              </option>
            ))}
          </select>

          <button style={btnPrimary} onClick={onGeneratePdf} disabled={!studentId}>
            Générer PDF bulletin
          </button>
        </div>
      </div>
    </div>
  );
}

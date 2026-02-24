"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type UUID,
  type Level,
  type TeacherContext,
  type ClassGroup,
  type Student,
  type Assessment,
  type Resultat,
  getTeacherContext,
  listClassGroups,
  upsertClassGroup,
  deleteClassGroup,
  listStudentsInClass,
  addStudentAndEnroll,
  listAssessmentsForClass,
  upsertResult,
  listResultatsForStudent,
} from "../resultats/resultats";

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

export default function TeacherCotationView() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  const [valueInput, setValueInput] = useState("");
  const [levelInput, setLevelInput] = useState<Level | "">("");

  const canSaveResult = useMemo(() => {
    if (!ctx || !studentId || !assessmentId) return false;
    return valueInput.trim() !== "" || levelInput !== "";
  }, [ctx, studentId, assessmentId, valueInput, levelInput]);

  async function boot() {
    try {
      setErr(null);
      const c = await getTeacherContext();
      setCtx(c);
      const cls = await listClassGroups(c);
      setClasses(cls);
      if (cls[0]?.id) setClassId(cls[0].id);
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
      const newId = await upsertClassGroup(ctx, { name: newClassName, grade_level: newClassGrade });
      const cls = await listClassGroups(ctx);
      setClasses(cls);
      setClassId(newId);
      setNewClassName("");
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function onDeleteClass() {
    if (!ctx || !classId) return;
    try {
      setErr(null);
      await deleteClassGroup(ctx, classId);
      const cls = await listClassGroups(ctx);
      setClasses(cls);
      setClassId(cls[0]?.id ?? "");
    } catch (e: unknown) {
      setErr(errorMessage(e));
    }
  }

  async function onAddStudent() {
    if (!ctx || !classId) return;
    try {
      setErr(null);
      await addStudentAndEnroll(ctx, {
        classGroupId: classId,
        first_name: newStudentFirst,
        last_name: newStudentLast,
      });
      setNewStudentFirst("");
      setNewStudentLast("");
      await reloadClassData(ctx, classId);
    } catch (e: unknown) {
      setErr(errorMessage(e));
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

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Classes / Élèves</div>
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

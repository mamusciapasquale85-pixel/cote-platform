"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateFR } from "@/lib/date";
import {
  type UUID,
  type TeacherContext,
  type ClassGroup,
  type StudentLite,
  type DisciplineNoteRow,
  getTeacherContext,
  listClassGroups,
  listStudentsForClass,
  createDisciplineNote,
  listDisciplineNotes,
  toNiceError,
} from "./remarques";

const card: React.CSSProperties = {
  borderRadius: 22,
  padding: 16,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow-soft)",
};

const input: React.CSSProperties = {
  minHeight: 46,
  width: "100%",
  padding: "11px 13px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.96)",
  color: "var(--text)",
};

const btn: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid var(--primary)",
  background: "var(--primary)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "0 12px 24px rgba(79,124,255,0.28)",
};

export default function DisciplinePage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [rows, setRows] = useState<DisciplineNoteRow[]>([]);

  const [classId, setClassId] = useState<UUID | "">("");
  const [studentId, setStudentId] = useState<UUID | "">("");
  const [note, setNote] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedStudent = useMemo(() => students.find((s) => s.id === studentId) ?? null, [students, studentId]);

  async function loadStudentsAndNotes(currentCtx: TeacherContext, nextClassId: UUID | "") {
    setStudents([]);
    setStudentId("");

    const [nextStudents, nextNotes] = await Promise.all([
      nextClassId ? listStudentsForClass(currentCtx, nextClassId) : Promise.resolve([] as StudentLite[]),
      listDisciplineNotes(currentCtx, { classGroupId: nextClassId, limit: 80 }),
    ]);

    setStudents(nextStudents);
    setRows(nextNotes);
  }

  async function boot() {
    try {
      setErrorMsg(null);
      const currentCtx = await getTeacherContext();
      setCtx(currentCtx);

      const cls = await listClassGroups(currentCtx);
      setClasses(cls);

      const firstClassId = cls[0]?.id ?? "";
      setClassId(firstClassId);
      await loadStudentsAndNotes(currentCtx, firstClassId);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  useEffect(() => {
    void boot();
  }, []);

  async function onChangeClass(nextClassId: UUID | "") {
    setClassId(nextClassId);
    setInfoMsg(null);
    setErrorMsg(null);
    if (!ctx) return;

    try {
      await loadStudentsAndNotes(ctx, nextClassId);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function onAdd() {
    if (!ctx) return;
    try {
      setErrorMsg(null);
      setInfoMsg(null);

      if (!classId) {
        setErrorMsg("Sélectionne une classe.");
        return;
      }
      if (!studentId) {
        setErrorMsg("Sélectionne un élève.");
        return;
      }
      if (!note.trim()) {
        setErrorMsg("La note est vide.");
        return;
      }

      setSaving(true);
      await createDisciplineNote(ctx, { classGroupId: classId, studentId, note });
      setNote("");
      const refreshed = await listDisciplineNotes(ctx, { classGroupId: classId, limit: 80 });
      setRows(refreshed);
      setInfoMsg("Note de discipline ajoutée ✅");
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {errorMsg && (
        <div style={card}>
          <b>Erreur:</b> {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div style={{ ...card, borderColor: "rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.06)" }}>{infoMsg}</div>
      )}

      <div style={card}>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Discipline</div>
        <div style={{ opacity: 0.8 }}>Suivi des remarques de discipline par élève.</div>
      </div>

      <div style={card}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontWeight: 800, fontSize: 13 }}>Classe</label>
              <select style={input} value={classId} onChange={(e) => void onChangeClass(e.target.value as UUID | "")}>
                <option value="">Choisir une classe</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.grade_level ? ` (niveau ${c.grade_level})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontWeight: 800, fontSize: 13 }}>Élève</label>
              <select style={input} value={studentId} onChange={(e) => setStudentId(e.target.value as UUID | "")}
                disabled={!classId || students.length === 0}
              >
                <option value="">Choisir un élève</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.last_name} {s.first_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontWeight: 800, fontSize: 13 }}>Note de discipline</label>
            <textarea
              style={{ ...input, minHeight: 110, resize: "vertical" }}
              placeholder="Décris la remarque..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div>
            <button style={btn} onClick={() => void onAdd()} disabled={!classId || !studentId || !note.trim() || saving}>
              {saving ? "Ajout..." : "Ajouter"}
            </button>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
          Historique {selectedStudent ? `— ${selectedStudent.last_name} ${selectedStudent.first_name}` : ""}
        </div>

        {rows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>
            {classId ? "Aucune note de discipline pour cette classe." : "Sélectionne une classe."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((row) => (
              <div
                key={row.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 10,
                  background: "rgba(0,0,0,0.01)",
                }}
              >
                <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
                  {formatDateFR(row.created_at)} · {row.class_name ?? "Classe"} · {row.student_last_name} {row.student_first_name}
                </div>
                <div>{row.note}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

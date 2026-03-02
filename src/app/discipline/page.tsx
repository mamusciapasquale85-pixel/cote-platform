"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateFR } from "@/lib/date";
import {
  type UUID,
  type StudentLite,
  type Remarque,
  type RemarqueType,
  getTeacherContext,
  listStudents,
  createRemarque,
  listRemarquesForStudent,
  toNiceError,
} from "./remarques";

const card: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "white",
  border: "1px solid rgba(0,0,0,0.10)",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
};

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "rgba(37,99,235,0.10)",
  borderColor: "rgba(37,99,235,0.25)",
  cursor: "pointer",
  fontWeight: 800,
};

const TYPE_LABEL: Record<string, string> = {
  discipline: "Discipline",
  suivi: "Suivi",
  parent: "Parent",
  retard: "Retard",
  materiel: "Matériel",
  autre: "Autre",
};

export default function DisciplinePage() {
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof getTeacherContext>> | null>(null);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [studentId, setStudentId] = useState<UUID | "">("");
  const [type, setType] = useState<RemarqueType>("discipline");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Remarque[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedStudent = useMemo(() => students.find((s) => s.id === studentId) ?? null, [students, studentId]);

  async function refreshRemarques(currentCtx: Awaited<ReturnType<typeof getTeacherContext>>, sid: UUID | "") {
    if (!sid) {
      setRows([]);
      return;
    }
    const list = await listRemarquesForStudent(currentCtx, sid);
    setRows(list);
  }

  useEffect(() => {
    (async () => {
      try {
        setErrorMsg(null);
        const c = await getTeacherContext();
        setCtx(c);
        const list = await listStudents(c);
        setStudents(list);

        let sidFromQuery = "";
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          sidFromQuery = params.get("student_id") ?? "";
        }

        const initial = (sidFromQuery && list.some((s) => s.id === sidFromQuery)) ? sidFromQuery : (list[0]?.id ?? "");
        setStudentId(initial);
        await refreshRemarques(c, initial as UUID | "");
      } catch (e: unknown) {
        setErrorMsg(toNiceError(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!ctx) return;
    void refreshRemarques(ctx, studentId).catch((e: unknown) => setErrorMsg(toNiceError(e)));
  }, [ctx, studentId]);

  async function onAdd() {
    if (!ctx) return;
    try {
      setErrorMsg(null);
      setInfoMsg(null);
      if (!studentId) {
        setErrorMsg("Sélectionne un élève.");
        return;
      }
      if (!text.trim()) {
        setErrorMsg("Le texte de la remarque est vide.");
        return;
      }
      setSaving(true);
      await createRemarque(ctx, { student_id: studentId, type, text });
      setText("");
      await refreshRemarques(ctx, studentId);
      setInfoMsg("Remarque ajoutée ✅");
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
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Remarques</div>
        <div style={{ opacity: 0.8 }}>Remarques élève (V1)</div>
      </div>

      <div style={card}>
        <div style={{ display: "grid", gap: 10 }}>
          <select style={input} value={studentId} onChange={(e) => setStudentId(e.target.value as UUID | "")}>
            <option value="">Choisir un élève (obligatoire)</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.last_name} {s.first_name}
              </option>
            ))}
          </select>

          <select style={input} value={type} onChange={(e) => setType(e.target.value as RemarqueType)}>
            <option value="discipline">Discipline</option>
            <option value="suivi">Suivi</option>
            <option value="parent">Parent</option>
            <option value="retard">Retard</option>
            <option value="materiel">Matériel</option>
            <option value="autre">Autre</option>
          </select>

          <textarea
            style={{ ...input, minHeight: 100, resize: "vertical" }}
            placeholder="Ajouter une remarque..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div>
            <button style={btn} onClick={() => void onAdd()} disabled={!studentId || !text.trim() || saving}>
              Ajouter
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
            {studentId ? "Aucune remarque pour cet élève." : "Sélectionne un élève pour afficher l’historique."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((row) => (
              <div
                key={row.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 10,
                  padding: 10,
                  background: "rgba(0,0,0,0.01)",
                }}
              >
                <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
                  {formatDateFR(row.created_at)} · {TYPE_LABEL[row.type] ?? row.type}
                </div>
                <div>{row.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import {
  type UUID,
  type TeacherContext,
  type ClassGroup,
  type Course,
  type Assessment,
  type AssessmentType,
  type ContentStatus,
  getTeacherContext,
  listClassGroups,
  listCourses,
  listAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
} from "./evaluations";

// helpers
function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

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

export default function EvaluationsPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [filterClassId, setFilterClassId] = useState<UUID | "">("");
  const [filterCourseId, setFilterCourseId] = useState<UUID | "">("");

  const [rows, setRows] = useState<Assessment[]>([]);

  // Create form
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AssessmentType>("summative");
  const [date, setDate] = useState(toISODate(new Date()));
  const [maxPoints, setMaxPoints] = useState<number>(20);
  const [weight, setWeight] = useState<string>(""); // optionnel
  const [status, setStatus] = useState<ContentStatus>("draft");
  const [parentVisible, setParentVisible] = useState(false);
  const [instructions, setInstructions] = useState("");

  const canCreate = useMemo(() => {
    return !!ctx && title.trim().length > 0 && filterClassId !== "" && filterCourseId !== "";
  }, [ctx, title, filterClassId, filterCourseId]);

  async function boot() {
    try {
      setErrorMsg(null);
      const c = await getTeacherContext();
      setCtx(c);

      const cls = await listClassGroups(c);
      setClasses(cls);

      const crs = await listCourses(c);
      setCourses(crs);

      if (cls[0]?.id) setFilterClassId(cls[0].id);
      if (crs[0]?.id) setFilterCourseId(crs[0].id);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function refresh(c: TeacherContext, classId: UUID | "", courseId: UUID | "") {
    try {
      setErrorMsg(null);
      const list = await listAssessments({
        ctx: c,
        classGroupId: classId === "" ? null : classId,
        courseId: courseId === "" ? null : courseId,
      });
      setRows(list);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  useEffect(() => {
    boot();
  }, []);

  useEffect(() => {
    if (!ctx) return;
    refresh(ctx, filterClassId, filterCourseId);
  }, [ctx, filterClassId, filterCourseId]);

  async function onCreate() {
    if (!ctx) return;

    try {
      setErrorMsg(null);

      if (!title.trim()) return setErrorMsg("Titre obligatoire.");
      if (filterClassId === "" || filterCourseId === "") return setErrorMsg("Choisis une classe ET un cours.");

      const w = weight.trim() ? Number(weight) : null;
      if (weight.trim() && Number.isNaN(w)) return setErrorMsg("Poids invalide (nombre attendu).");

      await createAssessment({
        ctx,
        title: title.trim(),
        type,
        date,
        max_points: maxPoints,
        weight: w,
        status,
        parent_visible: parentVisible,
        instructions: instructions.trim() ? instructions.trim() : null,
        class_group_id: filterClassId,
        course_id: filterCourseId,
      });

      setTitle("");
      setInstructions("");
      setWeight("");

      await refresh(ctx, filterClassId, filterCourseId);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function onDelete(id: UUID) {
    if (!ctx) return;
    try {
      setErrorMsg(null);
      await deleteAssessment({ ctx, assessmentId: id });
      await refresh(ctx, filterClassId, filterCourseId);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  async function onToggleStatus(a: Assessment) {
    if (!ctx) return;
    try {
      setErrorMsg(null);
      const next: ContentStatus = a.status === "draft" ? "published" : "draft";
      await updateAssessment({ ctx, assessmentId: a.id, patch: { status: next } });
      await refresh(ctx, filterClassId, filterCourseId);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  return (
    <div>
      {errorMsg && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontWeight: 900 }}>{errorMsg}</div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Filtres</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            style={{ ...input, width: 280 }}
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value as any)}
          >
            <option value="">Toutes les classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.grade_level ? ` (niveau ${c.grade_level})` : ""}
              </option>
            ))}
          </select>

          <select
            style={{ ...input, width: 280 }}
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value as any)}
          >
            <option value="">Tous les cours</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button style={btn} onClick={() => ctx && refresh(ctx, filterClassId, filterCourseId)} disabled={!ctx}>
            Rafraîchir
          </button>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>➕ Créer une évaluation</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 10 }}>
          <input
            style={input}
            placeholder="Titre (ex: Eval vocabulaire)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select style={input} value={type} onChange={(e) => setType(e.target.value as AssessmentType)}>
            <option value="summative">summative</option>
            <option value="formative">formative</option>
          </select>

          <input type="date" style={input} value={date} onChange={(e) => setDate(e.target.value)} />
          <input
            style={input}
            value={String(maxPoints)}
            onChange={(e) => setMaxPoints(Number(e.target.value))}
            inputMode="numeric"
            placeholder="Max points"
          />

          <input style={input} placeholder="Poids (optionnel)" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <select style={input} value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)}>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </div>

        <div style={{ height: 10 }} />

        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={parentVisible} onChange={(e) => setParentVisible(e.target.checked)} />
          Visible parents
        </label>

        <div style={{ height: 10 }} />

        <textarea
          style={{ ...input, minHeight: 90 }}
          placeholder="Instructions (optionnel)"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />

        <div style={{ height: 10 }} />
        <button style={btnPrimary} onClick={onCreate} disabled={!canCreate}>
          + Créer
        </button>
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>📚 Mes évaluations</div>

        {rows.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Aucune évaluation.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((a) => (
              <div
                key={a.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.10)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900 }}>
                    {a.title}{" "}
                    <span style={{ opacity: 0.7, fontWeight: 700 }}>
                      ({a.type}) — {a.max_points ?? "?"} pts — {a.date ?? ""}
                    </span>
                  </div>
                  <div style={{ opacity: 0.75, marginTop: 4 }}>
                    Status: <b>{a.status}</b> · Parents: {a.parent_visible ? "Oui" : "Non"}
                  </div>
                  {a.instructions && <div style={{ marginTop: 6 }}>{a.instructions}</div>}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button style={btn} onClick={() => onToggleStatus(a)}>
                    {a.status === "draft" ? "Publier" : "Repasser en draft"}
                  </button>
                  <button style={btn} onClick={() => onDelete(a.id)}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, opacity: 0.65, fontSize: 12 }}>
          École: {ctx?.schoolId ?? "…"} · Année: {ctx?.academicYearId ?? "…"}
        </div>
      </div>
    </div>
  );
}

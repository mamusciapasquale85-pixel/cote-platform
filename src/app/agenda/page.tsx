"use client";

import { useEffect, useMemo, useState } from "react";

import {
  type UUID,
  type AgendaItem,
  type AgendaType,
  type ClassGroup,
  type TeacherContext,
  getTeacherContext,
  listClassGroups,
  listAgendaItems,
  createAgendaItem,
  deleteAgendaItem,
} from "./agenda";

const TYPE_LABEL: Record<AgendaType, string> = {
  lesson: "Leçon",
  homework: "Devoir",
  test: "Interro",
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Parse "YYYY-MM-DD" en Date locale (sans décalage UTC surprise)
 * Important pour éviter les bugs "la veille" selon le fuseau.
 */
function fromISODate(iso: string) {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0); // midi pour éviter DST
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeekMonday(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=dim
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function AgendaPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [filterClassId, setFilterClassId] = useState<UUID | "">("");

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const [items, setItems] = useState<AgendaItem[]>([]);

  // Add form
  const [formDate, setFormDate] = useState<string>(toISODate(new Date()));
  const [formType, setFormType] = useState<AgendaType>("lesson");
  const [formClassId, setFormClassId] = useState<UUID | "">("");
  const [formTitle, setFormTitle] = useState("");
  const [formDetails, setFormDetails] = useState("");

  async function boot() {
    try {
      setErrorMsg(null);
      const c = await getTeacherContext();
      setCtx(c);
      const cls = await listClassGroups(c);
      setClasses(cls);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    }
  }

  async function loadWeek(c: TeacherContext, ws: Date) {
    try {
      setErrorMsg(null);
      const from = toISODate(ws);
      const to = toISODate(addDays(ws, 6));
      const classGroupId = filterClassId === "" ? null : (filterClassId as UUID);

      const rows = await listAgendaItems({
        ctx: c,
        dateFrom: from,
        dateTo: to,
        classGroupId: classGroupId ?? undefined,
      });

      setItems(rows);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    boot();
  }, []);

  useEffect(() => {
    if (!ctx) return;
    loadWeek(ctx, weekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, weekStart, filterClassId]);

  const days = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => toISODate(addDays(weekStart, i))),
    [weekStart]
  );

  const itemsByDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const d of days) map.set(d, []);
    for (const it of items) {
      if (!map.has(it.date)) map.set(it.date, []);
      map.get(it.date)!.push(it);
    }
    return map;
  }, [items, days]);

  async function onAdd() {
    if (!ctx) return;
    try {
      setErrorMsg(null);

      if (!formTitle.trim()) {
        setErrorMsg("Titre obligatoire.");
        return;
      }

      const classGroupId = formClassId === "" ? null : (formClassId as UUID);

      await createAgendaItem({
        ctx,
        classGroupId,
        date: formDate,
        type: formType,
        title: formTitle.trim(),
        details: formDetails.trim() ? formDetails.trim() : null,
      });

      // reset minimal
      setFormTitle("");
      setFormDetails("");

      // ✅ IMPORTANT : bascule sur la semaine de la date ajoutée
      const targetWeekStart = startOfWeekMonday(fromISODate(formDate));
      setWeekStart(targetWeekStart);

      // Recharge la semaine (immédiat) :
      await loadWeek(ctx, targetWeekStart);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    }
  }

  async function onDelete(id: UUID) {
    if (!ctx) return;
    try {
      setErrorMsg(null);
      await deleteAgendaItem({ ctx, id });
      await loadWeek(ctx, weekStart);
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
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

  return (
    <div>
      {errorMsg && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontWeight: 900 }}>{errorMsg}</div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
          Semaine du {toISODate(weekStart)} au {toISODate(weekEnd)}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button style={btn} onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ← Semaine -1
          </button>
          <button style={btn} onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
            Aujourd&apos;hui
          </button>
          <button style={btn} onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Semaine +1 →
          </button>

          <div style={{ flex: 1 }} />

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
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>➕ Ajouter (rapide)</div>

        <div style={{ display: "grid", gridTemplateColumns: "180px 180px 1fr", gap: 10 }}>
          <input type="date" style={input} value={formDate} onChange={(e) => setFormDate(e.target.value)} />

          <select style={input} value={formType} onChange={(e) => setFormType(e.target.value as AgendaType)}>
            <option value="lesson">Leçon</option>
            <option value="homework">Devoir</option>
            <option value="test">Interro</option>
          </select>

          <select style={input} value={formClassId} onChange={(e) => setFormClassId(e.target.value as any)}>
            <option value="">(Optionnel) Classe</option>
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
          style={input}
          placeholder="Titre (ex: Rit 2 – hobbies / Interro vocab)"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
        />

        <div style={{ height: 10 }} />

        <textarea
          style={{ ...input, minHeight: 90 }}
          placeholder="Détails (optionnel) : consignes, pages, matériel…"
          value={formDetails}
          onChange={(e) => setFormDetails(e.target.value)}
        />

        <div style={{ height: 10 }} />
        <button style={btnPrimary} onClick={onAdd} disabled={!ctx}>
          Ajouter
        </button>
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>📌 Semaine</div>

        {days.map((day) => {
          const dayItems = itemsByDay.get(day) ?? [];
          return (
            <div key={day} style={{ padding: "10px 0", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>{day}</div>

              {dayItems.length === 0 ? (
                <div style={{ opacity: 0.7 }}>Aucun item.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {dayItems.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.10)",
                        display: "flex",
                        gap: 10,
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900 }}>
                          {TYPE_LABEL[it.type]} — {it.title}
                        </div>
                        <div style={{ opacity: 0.85, marginTop: 2 }}>
                          {(() => {
                            const cg = Array.isArray((it as any).class_groups)
                              ? (it as any).class_groups[0]
                              : (it as any).class_groups;
                            return cg?.name ? `Classe: ${cg.name}` : "Classe: (non précisée)";
                          })()}
                        </div>
                        {it.details && <div style={{ marginTop: 6 }}>{it.details}</div>}
                      </div>

                      <button style={btn} onClick={() => onDelete(it.id)}>
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

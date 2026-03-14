"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateFR } from "@/lib/date";
import PlanifierSeanceModal from "@/components/remediation/PlanifierSeanceModal";

type SeanceStatut = "Planifiee" | "Realisee" | "Annulee";
type FiltrePeriode = "all" | "week" | "month";

type SeanceItem = {
  id: string;
  date_seance: string;
  duree_minutes: number;
  statut: SeanceStatut;
  notes: string | null;
  created_at: string;
  remediation_id: string;
  remediation: {
    id: string;
    attendu: string | null;
    type_remediation: string | null;
    classe_id: string | null;
    evaluation_titre: string | null;
  };
  eleves: Array<{
    eleve_id: string;
    first_name: string;
    last_name: string;
  }>;
};

function toNiceError(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message) return error.message;
    if ("error_description" in error && typeof error.error_description === "string" && error.error_description) {
      return error.error_description;
    }
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function statusLabel(status: SeanceStatut): "Planifiée" | "Réalisée" | "Annulée" {
  if (status === "Planifiee") return "Planifiée";
  if (status === "Realisee") return "Réalisée";
  return "Annulée";
}

function statusStyle(status: SeanceStatut): React.CSSProperties {
  if (status === "Planifiee") {
    return {
      color: "#B45309",
      borderColor: "rgba(245,158,11,0.35)",
      background: "rgba(245,158,11,0.14)",
    };
  }
  if (status === "Realisee") {
    return {
      color: "#0A63BF",
      borderColor: "rgba(10,132,255,0.35)",
      background: "rgba(10,132,255,0.14)",
    };
  }
  return {
    color: "#B91C1C",
    borderColor: "rgba(220,38,38,0.35)",
    background: "rgba(220,38,38,0.14)",
  };
}

function dotColor(status: SeanceStatut): string {
  if (status === "Planifiee") return "#F59E0B";
  if (status === "Realisee") return "#0A84FF";
  return "#DC2626";
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function localDateKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function inPeriod(dateIso: string, period: FiltrePeriode): boolean {
  if (period === "all") return true;
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();

  if (period === "week") {
    const start = startOfWeek(now);
    const end = endOfWeek(now);
    return date >= start && date <= end;
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  const sameMonth = date.getMonth() === now.getMonth();
  return sameYear && sameMonth;
}

function compareIsoDate(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            borderRadius: 14,
            border: "1px solid rgba(15,23,42,0.10)",
            background: "#fff",
            padding: 12,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ height: 16, width: "30%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
          <div style={{ height: 14, width: "60%", borderRadius: 999, background: "rgba(15,23,42,0.07)" }} />
          <div style={{ height: 14, width: "50%", borderRadius: 999, background: "rgba(15,23,42,0.07)" }} />
        </div>
      ))}
    </div>
  );
}

export default function SeancesRemediationPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<SeanceItem[]>([]);

  const [statutFilter, setStatutFilter] = useState<SeanceStatut | "all">("all");
  const [periodeFilter, setPeriodeFilter] = useState<FiltrePeriode>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SeanceItem | null>(null);
  const [savingInlineId, setSavingInlineId] = useState<string | null>(null);

  async function loadSeances() {
    try {
      setLoading(true);
      setErrorMsg(null);

      const response = await fetch("/api/seances-remediation", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as { items?: SeanceItem[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de charger les séances.");
      }

      const items = (payload.items ?? []).sort((a, b) => compareIsoDate(a.date_seance, b.date_seance));
      setRows(items);
    } catch (error: unknown) {
      setRows([]);
      setErrorMsg(toNiceError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSeances();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const statusOk = statutFilter === "all" || row.statut === statutFilter;
      const periodOk = inPeriod(row.date_seance, periodeFilter);
      return statusOk && periodOk;
    });
  }, [rows, statutFilter, periodeFilter]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, SeanceItem[]>();

    for (const row of filteredRows) {
      const key = localDateKey(row.date_seance);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }

    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, items]) => ({
        date,
        label: formatDateFR(date),
        items: items.sort((a, b) => compareIsoDate(a.date_seance, b.date_seance)),
      }));
  }, [filteredRows]);

  async function updateStatutInline(id: string, nextStatut: SeanceStatut) {
    const previous = rows;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, statut: nextStatut } : row)));
    setSavingInlineId(id);
    setErrorMsg(null);

    try {
      const response = await fetch(`/api/seances-remediation/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: nextStatut }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Impossible de mettre à jour le statut.");
      }
    } catch (error: unknown) {
      setRows(previous);
      setErrorMsg(toNiceError(error));
    } finally {
      setSavingInlineId(null);
    }
  }

  async function deleteSeance(id: string) {
    const ok = window.confirm("Supprimer cette séance ?");
    if (!ok) return;

    const previous = rows;
    setRows((current) => current.filter((row) => row.id !== id));
    setErrorMsg(null);

    try {
      const response = await fetch(`/api/seances-remediation/${id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Impossible de supprimer la séance.");
      }
    } catch (error: unknown) {
      setRows(previous);
      setErrorMsg(toNiceError(error));
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section
        style={{
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,0.10)",
          background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)",
          padding: 16,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 900 }}>📅 Séances de remédiation</div>
        <button
          style={{
            minHeight: 40,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.45)",
            background: "rgba(255,255,255,0.18)",
            color: "#fff",
            padding: "8px 12px",
            fontWeight: 800,
            cursor: "pointer",
          }}
          onClick={() => setCreateOpen(true)}
        >
          + Nouvelle séance
        </button>
      </section>

      {errorMsg && (
        <section
          style={{
            borderRadius: 12,
            border: "1px solid rgba(220,38,38,0.28)",
            background: "rgba(220,38,38,0.08)",
            color: "#991B1B",
            padding: "10px 12px",
          }}
        >
          <b>Erreur :</b> {errorMsg}
        </section>
      )}

      <section
        style={{
          borderRadius: 16,
          border: "1px solid rgba(15,23,42,0.10)",
          background: "#fff",
          padding: 12,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 200 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Statut</label>
            <select
              value={statutFilter}
              onChange={(event) => setStatutFilter(event.target.value as SeanceStatut | "all")}
              style={{
                width: "100%",
                minHeight: 40,
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)",
                padding: "8px 10px",
              }}
            >
              <option value="all">Toutes</option>
              <option value="Planifiee">Planifiée</option>
              <option value="Realisee">Réalisée</option>
              <option value="Annulee">Annulée</option>
            </select>
          </div>

          <div style={{ minWidth: 220 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Période</label>
            <select
              value={periodeFilter}
              onChange={(event) => setPeriodeFilter(event.target.value as FiltrePeriode)}
              style={{
                width: "100%",
                minHeight: 40,
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)",
                padding: "8px 10px",
              }}
            >
              <option value="all">Toutes</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
            </select>
          </div>

          <button
            onClick={() => void loadSeances()}
            style={{
              minHeight: 40,
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.15)",
              background: "#fff",
              padding: "8px 12px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : groupedByDay.length === 0 ? (
          <div
            style={{
              borderRadius: 12,
              border: "1px dashed rgba(15,23,42,0.16)",
              minHeight: 120,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              color: "rgba(15,23,42,0.62)",
              padding: 12,
            }}
          >
            Aucune séance planifiée — créez-en une depuis le Kanban.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {groupedByDay.map((group) => (
              <section key={group.date} style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{group.label}</div>

                <div style={{ display: "grid", gap: 8 }}>
                  {group.items.map((item) => {
                    const elevesLabel = item.eleves.length
                      ? item.eleves
                          .map((eleve) => `${eleve.first_name} ${eleve.last_name}`.trim())
                          .join(", ")
                      : "Aucun élève";

                    return (
                      <article
                        key={item.id}
                        style={{
                          borderRadius: 12,
                          border: "1px solid rgba(15,23,42,0.10)",
                          background: "#fff",
                          padding: 10,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800 }}>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: dotColor(item.statut),
                                display: "inline-block",
                              }}
                            />
                            <span>
                              {formatTime(item.date_seance)} — {item.duree_minutes} min
                            </span>
                          </div>

                          <span
                            style={{
                              borderRadius: 999,
                              padding: "4px 10px",
                              border: "1px solid",
                              fontWeight: 800,
                              fontSize: 12,
                              ...statusStyle(item.statut),
                            }}
                          >
                            {statusLabel(item.statut)}
                          </span>
                        </div>

                        <div style={{ fontWeight: 800 }}>
                          {item.remediation.attendu ?? "Attendu non défini"}
                          {item.remediation.evaluation_titre ? ` (${item.remediation.evaluation_titre})` : ""}
                        </div>

                        <div style={{ opacity: 0.8 }}>👥 {elevesLabel}</div>

                        {item.notes?.trim() ? <div style={{ opacity: 0.85 }}>📝 {item.notes.trim()}</div> : null}

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <select
                            value={item.statut}
                            onChange={(event) =>
                              void updateStatutInline(item.id, event.target.value as SeanceStatut)
                            }
                            disabled={savingInlineId === item.id}
                            style={{
                              minHeight: 34,
                              borderRadius: 8,
                              border: "1px solid rgba(15,23,42,0.15)",
                              padding: "6px 10px",
                            }}
                          >
                            <option value="Planifiee">Planifiée</option>
                            <option value="Realisee">Réalisée</option>
                            <option value="Annulee">Annulée</option>
                          </select>

                          <button
                            onClick={() => setEditing(item)}
                            style={{
                              minHeight: 34,
                              borderRadius: 8,
                              border: "1px solid rgba(15,23,42,0.15)",
                              background: "#fff",
                              padding: "6px 10px",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            ✏️
                          </button>

                          <button
                            onClick={() => void deleteSeance(item.id)}
                            style={{
                              minHeight: 34,
                              borderRadius: 8,
                              border: "1px solid rgba(220,38,38,0.26)",
                              background: "rgba(220,38,38,0.08)",
                              color: "#991B1B",
                              padding: "6px 10px",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {createOpen && (
        <PlanifierSeanceModal
          remediationId=""
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            void loadSeances();
          }}
        />
      )}

      {editing && (
        <PlanifierSeanceModal
          remediationId={editing.remediation_id}
          remediationAttendu={editing.remediation.attendu ?? undefined}
          seanceInitiale={{
            id: editing.id,
            remediation_id: editing.remediation_id,
            date_seance: editing.date_seance,
            duree_minutes: editing.duree_minutes,
            statut: editing.statut,
            notes: editing.notes,
            eleve_ids: editing.eleves.map((student) => student.eleve_id),
          }}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            void loadSeances();
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { formatDateFR } from "@/lib/date";
import PlanifierSeanceModal from "@/components/remediation/PlanifierSeanceModal";
import GenererExerciceModal from "@/components/remediation/GenererExerciceModal";

type ApiStatut = "Proposee" | "En cours" | "Terminee";
type UiStatut = "Proposée" | "En cours" | "Terminée";

type RemediationItem = {
  id: string;
  eleve_id: string | null;
  classe_id: string | null;
  assessment_id: string | null;
  statut: ApiStatut;
  type_remediation: string | null;
  attendu: string | null;
  origine: string | null;
  created_at: string | null;
  eleve_nom: string;
  classe_nom: string;
  evaluation_titre: string;
  date_seance: string | null;
  duree_minutes: number | null;
  seance_notes: string | null;
};

type GenererRemediationState = {
  id: string;
  attendu?: string;
  evaluationTitre?: string;
  eleveNom?: string;
};

type ApiResponse = {
  items?: RemediationItem[];
  error?: string;
};

type PatchResponse = {
  item?: { id: string; statut: ApiStatut | string };
  error?: string;
};

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
const STATUS_ORDER: ApiStatut[] = ["Proposee", "En cours", "Terminee"];

const STATUS_META: Record<
  ApiStatut,
  {
    label: UiStatut;
    icon: string;
    color: string;
    bg: string;
    border: string;
  }
> = {
  Proposee: {
    label: "Proposée",
    icon: "🟠",
    color: "#B45309",
    bg: "rgba(255,149,0,0.14)",
    border: "rgba(255,149,0,0.35)",
  },
  "En cours": {
    label: "En cours",
    icon: "🔵",
    color: "#0A63BF",
    bg: "rgba(10,132,255,0.14)",
    border: "rgba(10,132,255,0.35)",
  },
  Terminee: {
    label: "Terminée",
    icon: "🟢",
    color: "#15803D",
    bg: "rgba(52,199,89,0.14)",
    border: "rgba(52,199,89,0.35)",
  },
};

const CARD_STYLE: CSSProperties = {
  borderRadius: 18,
  background: "#FFFFFF",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.10)",
};

const INPUT_STYLE: CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.16)",
  padding: "10px 12px",
  background: "#FFFFFF",
  color: "#0F172A",
  width: "100%",
};

const BUTTON_STYLE: CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.16)",
  padding: "10px 14px",
  background: "#FFFFFF",
  color: "#0F172A",
  fontWeight: 700,
  cursor: "pointer",
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

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toApiStatut(value: string | null | undefined): ApiStatut {
  if (!value) return "Proposee";
  const normalized = normalizeText(value).replace(/\s+/g, " ");
  if (normalized === "proposee" || normalized === "propose") return "Proposee";
  if (normalized === "en cours" || normalized === "encours") return "En cours";
  if (normalized === "terminee" || normalized === "termine") return "Terminee";
  return "Proposee";
}

function formatSeance(item: RemediationItem): string {
  if (!item.date_seance) return "—";
  const datePart = formatDateFR(item.date_seance);
  return item.duree_minutes ? `${datePart} • ${item.duree_minutes} min` : datePart;
}

function mapResponseRows(rows: RemediationItem[]): RemediationItem[] {
  return rows.map((row) => ({
    ...row,
    statut: toApiStatut(row.statut),
    eleve_nom: row.eleve_nom || "Élève inconnu",
    classe_nom: row.classe_nom || "Classe inconnue",
    evaluation_titre: row.evaluation_titre || "—",
  }));
}

function LoadingSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12,
      }}
    >
      {STATUS_ORDER.map((status) => (
        <article key={`skeleton-${status}`} style={{ ...CARD_STYLE, padding: 12, minHeight: 240 }}>
          <div
            style={{
              height: 20,
              width: 160,
              borderRadius: 999,
              background: "rgba(15,23,42,0.08)",
              marginBottom: 10,
            }}
          />
          <div style={{ display: "grid", gap: 8 }}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`${status}-line-${index}`}
                style={{
                  height: 84,
                  borderRadius: 12,
                  background: "rgba(15,23,42,0.06)",
                  border: "1px solid rgba(15,23,42,0.06)",
                }}
              />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export default function RemediationsPage() {
  const [rows, setRows] = useState<RemediationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<ApiStatut | "all">("all");
  const [planifierRemediationId, setPlanifierRemediationId] = useState<string | null>(null);
  const [planifierEleveId, setPlanifierEleveId] = useState<string | null>(null);
  const [planifierAttendu, setPlanifierAttendu] = useState<string | null>(null);
  const [genererRemediation, setGenererRemediation] = useState<GenererRemediationState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const classOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of rows) {
      if (row.classe_id) {
        byId.set(row.classe_id, row.classe_nom || "Classe inconnue");
      }
    }
    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const classOk = classFilter === "all" || row.classe_id === classFilter;
      const statusOk = statusFilter === "all" || row.statut === statusFilter;
      return classOk && statusOk;
    });
  }, [rows, classFilter, statusFilter]);

  const rowsByStatus = useMemo(() => {
    return {
      Proposee: filteredRows.filter((row) => row.statut === "Proposee"),
      "En cours": filteredRows.filter((row) => row.statut === "En cours"),
      Terminee: filteredRows.filter((row) => row.statut === "Terminee"),
    } as Record<ApiStatut, RemediationItem[]>;
  }, [filteredRows]);

  async function loadRemediations() {
    try {
      setLoading(true);
      setErrorMsg(null);

      const response = await fetch("/api/remediations", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de charger les remédiations.");
      }

      setRows(mapResponseRows(Array.isArray(payload.items) ? payload.items : []));
    } catch (error: unknown) {
      setRows([]);
      setErrorMsg(toNiceError(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteRemediation(remediationId: string) {
    setDeletingId(remediationId);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/remediations/${remediationId}`, { method: "DELETE" });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || "Impossible de supprimer.");
      setRows((prev) => prev.filter((row) => row.id !== remediationId));
    } catch (error: unknown) {
      setErrorMsg(toNiceError(error));
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  async function updateStatus(remediationId: string, nextStatus: ApiStatut) {
    const previousStatus = rows.find((row) => row.id === remediationId)?.statut ?? "Proposee";

    setRows((prev) => prev.map((row) => (row.id === remediationId ? { ...row, statut: nextStatus } : row)));
    setSavingId(remediationId);
    setErrorMsg(null);

    try {
      const response = await fetch(`/api/remediations/${remediationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: nextStatus }),
      });
      const payload = (await response.json()) as PatchResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de mettre à jour le statut.");
      }

      const savedStatus = toApiStatut(payload.item?.statut ?? nextStatus);
      setRows((prev) => prev.map((row) => (row.id === remediationId ? { ...row, statut: savedStatus } : row)));
    } catch (error: unknown) {
      setRows((prev) => prev.map((row) => (row.id === remediationId ? { ...row, statut: previousStatus } : row)));
      setErrorMsg(toNiceError(error));
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    void loadRemediations();
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section
        style={{
          ...CARD_STYLE,
          padding: "18px 20px",
          color: "#FFFFFF",
          background: GRADIENT,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>Remédiations</div>
      </section>

      {errorMsg && (
        <section
          style={{
            ...CARD_STYLE,
            padding: "12px 14px",
            borderColor: "rgba(220, 38, 38, 0.28)",
            background: "rgba(220, 38, 38, 0.08)",
            color: "#991B1B",
          }}
        >
          <strong>Erreur :</strong> {errorMsg}
        </section>
      )}

      <section style={{ ...CARD_STYLE, padding: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 300px) minmax(220px, 260px) auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700 }}>Classe</label>
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} style={INPUT_STYLE}>
              <option value="all">Toutes les classes</option>
              {classOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700 }}>Statut</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter((event.target.value as ApiStatut | "all") ?? "all")}
              style={INPUT_STYLE}
            >
              <option value="all">Tous les statuts</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {STATUS_META[status].label}
                </option>
              ))}
            </select>
          </div>

          <button style={{ ...BUTTON_STYLE, width: 120 }} onClick={() => void loadRemediations()}>
            Rafraîchir
          </button>
        </div>
      </section>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {STATUS_ORDER.map((status) => {
            const items = rowsByStatus[status];
            const meta = STATUS_META[status];

            return (
              <article key={status} style={{ ...CARD_STYLE, padding: 12, display: "grid", gap: 10, minHeight: 220, alignContent: "start" }}>
                <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 18 }}>
                    <span aria-hidden>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 28,
                      minHeight: 28,
                      padding: "0 8px",
                      borderRadius: 999,
                      background: meta.bg,
                      color: meta.color,
                      border: `1px solid ${meta.border}`,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {items.length}
                  </span>
                </header>

                {items.length === 0 ? (
                  <div
                    style={{
                      flex: 1,
                      display: "grid",
                      placeItems: "center",
                      color: "rgba(15,23,42,0.52)",
                      borderRadius: 12,
                      border: "1px dashed rgba(15,23,42,0.16)",
                      minHeight: 120,
                      textAlign: "center",
                      padding: 12,
                    }}
                  >
                    Aucune remédiation
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
                    {items.map((item) => (
                      <article
                        key={item.id}
                        style={{
                          borderRadius: 14,
                          border: "1px solid rgba(15,23,42,0.10)",
                          background: "#FFFFFF",
                          padding: 12,
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              borderRadius: 999,
                              padding: "4px 10px",
                              fontSize: 12,
                              fontWeight: 800,
                              background: meta.bg,
                              color: meta.color,
                              border: `1px solid ${meta.border}`,
                            }}
                          >
                            {meta.label}
                          </div>
                          {confirmDeleteId === item.id ? (
                            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                              <button
                                type="button"
                                disabled={deletingId === item.id}
                                onClick={() => void deleteRemediation(item.id)}
                                style={{ height: 26, padding: "0 10px", borderRadius: 8, border: "1px solid #F87171", background: "#FEF2F2", cursor: "pointer", fontSize: 11, fontWeight: 800, color: "#B91C1C" }}
                              >
                                {deletingId === item.id ? "…" : "✓ Confirmer"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                style={{ height: 26, width: 26, borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#6B7280" }}
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              style={{ height: 26, width: 26, borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", fontSize: 13, color: "#B91C1C", display: "flex", alignItems: "center", justifyContent: "center" }}
                              title="Supprimer"
                            >
                              🗑
                            </button>
                          )}
                        </div>

                        <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                          <div><strong>👤 Élève :</strong> {item.eleve_nom}</div>
                          <div><strong>🏫 Classe :</strong> {item.classe_nom}</div>
                          <div><strong>📝 Évaluation liée :</strong> {item.evaluation_titre || "—"}</div>
                          <div><strong>🎯 Attendu :</strong> {item.attendu?.trim() || "—"}</div>
                          <div><strong>🔧 Type de remédiation :</strong> {item.type_remediation?.trim() || "—"}</div>
                          <div><strong>📅 Séance de remédiation :</strong> {formatSeance(item)}</div>
                          {item.seance_notes?.trim() ? (
                            <div style={{ color: "rgba(15,23,42,0.74)" }}>
                              <strong>Notes :</strong> {item.seance_notes.trim()}
                            </div>
                          ) : null}
                          <div><strong>Créée le :</strong> {item.created_at ? formatDateFR(item.created_at) : "—"}</div>
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                          <label style={{ fontSize: 12, fontWeight: 700 }} htmlFor={`status-${item.id}`}>
                            Statut
                          </label>
                          <select
                            id={`status-${item.id}`}
                            style={{ ...INPUT_STYLE, minHeight: 36, padding: "8px 10px", fontSize: 13 }}
                            value={item.statut}
                            disabled={savingId === item.id}
                            onChange={(event) => void updateStatus(item.id, event.target.value as ApiStatut)}
                          >
                            {STATUS_ORDER.map((statusOption) => (
                              <option key={`${item.id}-${statusOption}`} value={statusOption}>
                                {STATUS_META[statusOption].label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setPlanifierRemediationId(item.id);
                              setPlanifierEleveId(item.eleve_id);
                              setPlanifierAttendu(item.attendu);
                            }}
                            style={{
                              minHeight: 36,
                              borderRadius: 10,
                              border: "1px solid rgba(10,132,255,0.32)",
                              background: "rgba(10,132,255,0.10)",
                              color: "#0A63BF",
                              padding: "8px 10px",
                              fontSize: 13,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            📅 Planifier
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setGenererRemediation({
                                id: item.id,
                                attendu: item.attendu ?? undefined,
                                evaluationTitre: item.evaluation_titre || undefined,
                                eleveNom: item.eleve_nom || undefined,
                              })
                            }
                            style={{
                              minHeight: 36,
                              borderRadius: 10,
                              border: "1px solid rgba(249,115,22,0.34)",
                              background: "rgba(249,115,22,0.12)",
                              color: "#B45309",
                              padding: "8px 10px",
                              fontSize: 13,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            ✨ Exercice
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {planifierRemediationId && (
        <PlanifierSeanceModal
          remediationId={planifierRemediationId}
          remediationAttendu={planifierAttendu ?? undefined}
          eleveIdPreselectionne={planifierEleveId ?? undefined}
          onClose={() => {
            setPlanifierRemediationId(null);
            setPlanifierEleveId(null);
            setPlanifierAttendu(null);
          }}
          onSuccess={() => {
            setPlanifierRemediationId(null);
            setPlanifierEleveId(null);
            setPlanifierAttendu(null);
          }}
        />
      )}

      {genererRemediation && (
        <GenererExerciceModal
          remediationId={genererRemediation.id}
          attendu={genererRemediation.attendu}
          evaluationTitre={genererRemediation.evaluationTitre}
          eleveNom={genererRemediation.eleveNom}
          onClose={() => setGenererRemediation(null)}
        />
      )}
    </div>
  );
}

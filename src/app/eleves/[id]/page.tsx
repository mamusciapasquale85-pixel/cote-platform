"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { formatDateFR } from "@/lib/date";
import {
  type UUID,
  type TeacherContext,
  type StudentIdentity,
  type StudentClassInfo,
  type StudentResult,
  type Remarque,
  getTeacherContext,
  getStudentIdentity,
  getCurrentClassInfo,
  listStudentResults,
  listRecentRemarques,
} from "../eleves";

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    if ("message" in e && typeof e.message === "string") return e.message;
    if ("error_description" in e && typeof e.error_description === "string") return e.error_description;
  }
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}

function toPercent(sumValue: number, sumMax: number): string {
  if (sumMax <= 0) return "—";
  return `${((sumValue / sumMax) * 100).toFixed(1)} %`;
}

const card: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "white",
  border: "1px solid rgba(0,0,0,0.10)",
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

const TYPE_LABEL: Record<string, string> = {
  discipline: "Discipline",
  suivi: "Suivi",
  parent: "Parent",
  retard: "Retard",
  materiel: "Matériel",
  autre: "Autre",
};

export default function ElevePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = (params?.id as string | undefined) ?? "";

  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentIdentity | null>(null);
  const [classInfo, setClassInfo] = useState<StudentClassInfo | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [hasApprentissage, setHasApprentissage] = useState<boolean>(false);

  const [remarqueRows, setRemarqueRows] = useState<Remarque[]>([]);
  const [remarquesTableMissing, setRemarquesTableMissing] = useState(false);

  const [showCommModal, setShowCommModal] = useState(false);
  const [commText, setCommText] = useState("");

  const averages = useMemo(() => {
    const valid = results.filter((r) => r.value != null && r.max_points != null && (r.max_points ?? 0) > 0);

    let sumValue = 0;
    let sumMax = 0;
    for (const r of valid) {
      sumValue += r.value ?? 0;
      sumMax += r.max_points ?? 0;
    }

    const byApp = new Map<string, { label: string; sumValue: number; sumMax: number }>();
    if (hasApprentissage) {
      for (const r of valid) {
        const key = r.apprentissage_id ?? "__none__";
        const label = r.apprentissage_name ?? "Sans apprentissage";
        const current = byApp.get(key) ?? { label, sumValue: 0, sumMax: 0 };
        current.sumValue += r.value ?? 0;
        current.sumMax += r.max_points ?? 0;
        byApp.set(key, current);
      }
    }

    return {
      global: toPercent(sumValue, sumMax),
      byApprentissage: Array.from(byApp.values()).sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" })),
    };
  }, [results, hasApprentissage]);

  async function loadAll(currentCtx: TeacherContext, sid: UUID) {
    setErrorMsg(null);
    setInfoMsg(null);

    const [identity, cls, resultPayload, remarques] = await Promise.all([
      getStudentIdentity(currentCtx, sid),
      getCurrentClassInfo(currentCtx, sid),
      listStudentResults(currentCtx, sid),
      listRecentRemarques(currentCtx, sid, 5),
    ]);
    setStudent(identity);
    setClassInfo(cls);
    setResults(resultPayload.rows);
    setHasApprentissage(resultPayload.hasApprentissage);
    setRemarqueRows(remarques.rows);
    setRemarquesTableMissing(remarques.tableMissing);
  }

  useEffect(() => {
    (async () => {
      try {
        if (!studentId) throw new Error("ID élève manquant.");
        const c = await getTeacherContext();
        setCtx(c);
        await loadAll(c, studentId as UUID);
      } catch (e: unknown) {
        setErrorMsg(toNiceError(e));
      }
    })();
  }, [studentId]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {errorMsg && (
        <div style={card}>
          <b>Erreur:</b> {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div style={{ ...card, borderColor: "rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.06)" }}>
          {infoMsg}
        </div>
      )}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>
              {student ? `${student.last_name} ${student.first_name}` : "Fiche élève"}
            </div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              Classe: {classInfo?.class_name ?? "—"}
              {classInfo?.grade_level ? ` (niveau ${classInfo.grade_level})` : ""}
            </div>
          </div>
          <button style={btn} onClick={() => router.back()}>Retour</button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <div>
            <b>Référence</b>
            <div>{student?.student_ref ?? "—"}</div>
          </div>
          <div>
            <b>Email élève</b>
            <div>{student?.email ?? "—"}</div>
          </div>
          <div>
            <b>Téléphone parent</b>
            <div>{student?.parent_phone ?? "—"}</div>
          </div>
          <div>
            <b>Email parent</b>
            <div>{student?.parent_email ?? "—"}</div>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Résultats</div>
        <div style={{ marginBottom: 10 }}>
          Moyenne globale: <b>{averages.global}</b>
        </div>

        {hasApprentissage ? (
          <div style={{ marginBottom: 10 }}>
            <b>Moyenne par apprentissage</b>
            {averages.byApprentissage.length === 0 ? (
              <div style={{ opacity: 0.8, marginTop: 4 }}>Aucune moyenne disponible.</div>
            ) : (
              <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                {averages.byApprentissage.map((row) => (
                  <div key={row.label}>
                    {row.label}: <b>{toPercent(row.sumValue, row.sumMax)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 10, opacity: 0.8 }}>Moyenne détaillée indisponible sur ce schéma.</div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Évaluation</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Date</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Points</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Niveau</th>
                {hasApprentissage && (
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Apprentissage</th>
                )}
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td style={{ padding: 8, opacity: 0.8 }} colSpan={hasApprentissage ? 5 : 4}>Aucun résultat.</td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.title}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.date ? formatDateFR(r.date) : "—"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                      {r.value != null && r.max_points != null ? `${r.value}/${r.max_points}` : "—"}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{r.level ?? "—"}</td>
                    {hasApprentissage && (
                      <td style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                        {r.apprentissage_name ?? "—"}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Remarques</div>
          <Link href={`/discipline?student_id=${studentId}`} style={btn}>
            Voir tout
          </Link>
        </div>

        {remarquesTableMissing ? (
          <div style={{ marginTop: 10, marginBottom: 10, opacity: 0.85 }}>
            La table <code>remarques</code> n’est pas encore disponible. Applique la migration SQL puis recharge.
          </div>
        ) : remarqueRows.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.8 }}>Aucune remarque.</div>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {remarqueRows.map((row) => (
              <div key={row.id} style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 800 }}>
                  {formatDateFR(row.created_at)} · {TYPE_LABEL[row.type] ?? row.type}
                </div>
                <div style={{ marginTop: 4 }}>{row.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Communication parents</div>
        <button style={btn} onClick={() => setShowCommModal(true)}>Message aux parents</button>
        <div style={{ marginTop: 8, opacity: 0.8 }}>V1 placeholder: sauvegarde à brancher plus tard (table messages).</div>
      </div>

      {showCommModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowCommModal(false)}
        >
          <div
            style={{ width: "min(700px,96vw)", background: "white", borderRadius: 14, padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Message aux parents</div>
            <textarea
              style={{ width: "100%", minHeight: 120, resize: "vertical", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)" }}
              placeholder="Texte du message"
              value={commText}
              onChange={(e) => setCommText(e.target.value)}
            />
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button
                style={btnPrimary}
                onClick={() => {
                  setShowCommModal(false);
                  setCommText("");
                  setInfoMsg("TODO: brancher la table messages pour l’envoi.");
                }}
              >
                Enregistrer (TODO)
              </button>
              <button style={btn} onClick={() => setShowCommModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

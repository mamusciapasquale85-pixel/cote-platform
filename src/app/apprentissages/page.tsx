"use client";

import { useEffect, useState } from "react";
import {
  type UUID,
  type TeacherContext,
  type Apprentissage,
  getTeacherContext,
  listApprentissages,
  createApprentissage,
  updateApprentissage,
  reorderApprentissages,
} from "./apprentissages";

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
  color: "#171717",
  background: "#ffffff",
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

export default function ApprentissagesPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [items, setItems] = useState<Apprentissage[]>([]);
  const [draftNames, setDraftNames] = useState<Record<UUID, string>>({});

  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh(c: TeacherContext) {
    const rows = await listApprentissages(c);
    setItems(rows);
    setDraftNames((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (next[row.id] == null) next[row.id] = row.name;
      }
      return next;
    });
  }

  async function boot() {
    try {
      setErrorMsg(null);
      const c = await getTeacherContext();
      setCtx(c);
      await refresh(c);
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    }
  }

  useEffect(() => {
    void boot();
  }, []);

  async function onAdd() {
    if (!ctx) return;
    try {
      setErrorMsg(null);
      setInfoMsg(null);
      setSaving(true);
      await createApprentissage(ctx, { name: newName });
      setNewName("");
      await refresh(ctx);
      setInfoMsg("Apprentissage ajouté ✅");
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    } finally {
      setSaving(false);
    }
  }

  async function onRename(item: Apprentissage) {
    if (!ctx) return;
    try {
      setErrorMsg(null);
      setInfoMsg(null);
      setSaving(true);
      const name = (draftNames[item.id] ?? item.name).trim();
      if (!name) {
        setErrorMsg("Nom obligatoire.");
        return;
      }
      if (name === item.name) {
        setInfoMsg("Aucune modification.");
        return;
      }
      await updateApprentissage(ctx, { apprentissageId: item.id, patch: { name } });
      await refresh(ctx);
      setInfoMsg("Nom mis à jour ✅");
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(item: Apprentissage) {
    if (!ctx) return;
    try {
      setErrorMsg(null);
      setInfoMsg(null);
      setSaving(true);
      await updateApprentissage(ctx, {
        apprentissageId: item.id,
        patch: { active: !item.active },
      });
      await refresh(ctx);
      setInfoMsg(item.active ? "Apprentissage désactivé." : "Apprentissage activé ✅");
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    } finally {
      setSaving(false);
    }
  }

  async function onMove(index: number, direction: -1 | 1) {
    if (!ctx) return;
    const current = items[index];
    const target = items[index + direction];
    if (!current || !target) return;

    try {
      setErrorMsg(null);
      setInfoMsg(null);
      setSaving(true);
      await reorderApprentissages(ctx, {
        firstId: current.id,
        firstOrder: current.order_index,
        secondId: target.id,
        secondOrder: target.order_index,
      });
      await refresh(ctx);
      setInfoMsg("Ordre mis à jour ✅");
    } catch (e: unknown) {
      setErrorMsg(toNiceError(e));
    } finally {
      setSaving(false);
    }
  }

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
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Ajouter un apprentissage</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
          <input
            style={input}
            placeholder="Nom (ex: Période 1 - Nombres)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button style={btnPrimary} onClick={() => void onAdd()} disabled={!ctx || saving}>
            {saving ? "..." : "Ajouter"}
          </button>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Liste des apprentissages</div>

        {items.length === 0 ? (
          <div style={{ opacity: 0.75 }}>Aucun apprentissage pour cette année scolaire.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr auto auto auto auto",
                  gap: 10,
                  alignItems: "center",
                  padding: 10,
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 12,
                }}
              >
                <div style={{ fontWeight: 900, opacity: 0.75 }}>#{item.order_index}</div>

                <input
                  style={input}
                  value={draftNames[item.id] ?? item.name}
                  onChange={(e) => setDraftNames((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />

                <button style={btn} onClick={() => void onRename(item)} disabled={saving}>
                  Renommer
                </button>

                <button style={btn} onClick={() => void onToggleActive(item)} disabled={saving}>
                  {item.active ? "Désactiver" : "Activer"}
                </button>

                <button style={btn} onClick={() => void onMove(index, -1)} disabled={saving || index === 0}>
                  ↑
                </button>

                <button
                  style={btn}
                  onClick={() => void onMove(index, 1)}
                  disabled={saving || index === items.length - 1}
                >
                  ↓
                </button>

                <div style={{ gridColumn: "1 / -1", fontSize: 13, opacity: 0.75 }}>
                  Statut: <b>{item.active ? "Actif" : "Inactif"}</b>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

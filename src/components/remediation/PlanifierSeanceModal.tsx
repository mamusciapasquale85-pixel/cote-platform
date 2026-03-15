"use client";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type SeanceStatut = string;

interface SeanceInitiale {
  id: string;
  remediation_id: string;
  date_seance: string;
  duree_minutes: number;
  statut: SeanceStatut;
  notes: string | null;
  eleve_ids: string[];
}

interface PlanifierSeanceModalProps {
  remediationId: string;
  remediationAttendu?: string;
  eleveIdPreselectionne?: string;
  seanceInitiale?: SeanceInitiale;
  onClose: () => void;
  onSuccess: () => void;
}

type Seance = {
  id: string;
  date_seance: string;
  duree_minutes: number;
  statut: string;
  notes: string | null;
};

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
const STATUTS = ["Planifiee", "Realisee", "Annulee"];
const STATUT_LABELS: Record<string, string> = {
  Planifiee: "📅 Planifiée",
  Realisee: "✅ Réalisée",
  Annulee: "❌ Annulée",
};
const STATUT_COLORS: Record<string, string> = {
  Planifiee: "#0A84FF",
  Realisee: "#16a34a",
  Annulee: "#ef4444",
};

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}

function formatDateFRLocal(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function todayLocalISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function PlanifierSeanceModal({
  remediationId,
  remediationAttendu,
  onClose,
  onSuccess,
}: PlanifierSeanceModalProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Formulaire nouvelle séance
  const [dateSeance, setDateSeance] = useState(todayLocalISO());
  const [duree, setDuree] = useState(30);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Liste séances existantes
  const [seances, setSeances] = useState<Seance[]>([]);
  const [loadingSeances, setLoadingSeances] = useState(true);
  const [editingStatut, setEditingStatut] = useState<Record<string, string>>({});

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  async function loadSeances() {
    setLoadingSeances(true);
    const { data, error } = await supabase
      .from("seances_remediation")
      .select("id, date_seance, duree_minutes, statut, notes")
      .eq("remediation_id", remediationId)
      .order("date_seance", { ascending: false });
    if (!error && data) setSeances(data as Seance[]);
    setLoadingSeances(false);
  }

  useEffect(() => { void loadSeances(); }, [remediationId]);

  async function onSave() {
    try {
      setSaving(true); setErrorMsg(null); setSuccessMsg(null);
      const { error } = await supabase.from("seances_remediation").insert({
        remediation_id: remediationId,
        date_seance: new Date(dateSeance).toISOString(),
        duree_minutes: duree,
        notes: notes.trim() || null,
        statut: "Planifiee",
      });
      if (error) throw error;
      setSuccessMsg("✅ Séance planifiée avec succès !");
      setNotes("");
      setDuree(30);
      setDateSeance(todayLocalISO());
      await loadSeances();
      setTimeout(() => { onSuccess(); }, 1200);
    } catch (e) { setErrorMsg(toNiceError(e)); }
    finally { setSaving(false); }
  }

  async function onUpdateStatut(seanceId: string, newStatut: string) {
    setEditingStatut(prev => ({ ...prev, [seanceId]: newStatut }));
    const { error } = await supabase
      .from("seances_remediation")
      .update({ statut: newStatut })
      .eq("id", seanceId);
    if (error) setErrorMsg(toNiceError(error));
    else await loadSeances();
    setEditingStatut(prev => { const n = { ...prev }; delete n[seanceId]; return n; });
  }

  async function onDeleteSeance(seanceId: string) {
    if (!confirm("Supprimer cette séance ?")) return;
    const { error } = await supabase.from("seances_remediation").delete().eq("id", seanceId);
    if (error) setErrorMsg(toNiceError(error));
    else await loadSeances();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(3px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(720px, 98vw)", maxHeight: "90vh", overflowY: "auto", borderRadius: 20, background: "#f8fafc", boxShadow: "0 32px 80px rgba(15,23,42,0.28)", display: "flex", flexDirection: "column" }}>

        {/* HEADER */}
        <div style={{ padding: "18px 20px", borderRadius: "20px 20px 0 0", background: GRADIENT, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>📅 Planifier une séance</div>
            {remediationAttendu && <div style={{ fontSize: 13, opacity: 0.9, marginTop: 3 }}>Lacune : {remediationAttendu}</div>}
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 10, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* FORMULAIRE NOUVELLE SÉANCE */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, color: "#0f172a" }}>➕ Nouvelle séance</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>DATE ET HEURE</label>
                <input type="datetime-local" value={dateSeance} onChange={e => setDateSeance(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#fff", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>DURÉE (minutes)</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[15, 30, 45, 60].map(d => (
                    <button key={d} onClick={() => setDuree(d)} style={{
                      flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13,
                      border: duree === d ? "2px solid #0A84FF" : "1.5px solid #e2e8f0",
                      background: duree === d ? "#eff6ff" : "#fff",
                      color: duree === d ? "#0A63BF" : "#334155",
                    }}>{d}'</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>NOTES (optionnel)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Objectifs, matériel, remarques…" rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, resize: "vertical", background: "#fff", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>

            {errorMsg && <div style={{ borderRadius: 8, background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", padding: "8px 12px", fontSize: 13, marginBottom: 10 }}>⚠️ {errorMsg}</div>}
            {successMsg && <div style={{ borderRadius: 8, background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", padding: "8px 12px", fontSize: 13, marginBottom: 10 }}>{successMsg}</div>}

            <button onClick={() => void onSave()} disabled={saving} style={{
              width: "100%", padding: "12px", borderRadius: 10, border: "none",
              background: saving ? "#94a3b8" : GRADIENT, color: "#fff", fontWeight: 800, fontSize: 14, cursor: saving ? "wait" : "pointer",
            }}>
              {saving ? "Enregistrement…" : "📅 Planifier la séance"}
            </button>
          </div>

          {/* SÉANCES EXISTANTES */}
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: "#0f172a" }}>
              📋 Séances existantes {seances.length > 0 && <span style={{ fontWeight: 500, color: "#64748b", fontSize: 13 }}>({seances.length})</span>}
            </div>

            {loadingSeances ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#94a3b8" }}>Chargement…</div>
            ) : seances.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: 14, background: "#fff", borderRadius: 12, border: "1px dashed #e2e8f0" }}>
                Aucune séance planifiée pour cette remédiation.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {seances.map(s => (
                  <div key={s.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Statut badge */}
                    <select value={editingStatut[s.id] ?? s.statut} onChange={e => void onUpdateStatut(s.id, e.target.value)}
                      style={{ padding: "5px 8px", borderRadius: 8, border: `1.5px solid ${STATUT_COLORS[s.statut] ?? "#e2e8f0"}`, background: "#fff", fontWeight: 700, fontSize: 12, color: STATUT_COLORS[s.statut] ?? "#334155", cursor: "pointer" }}>
                      {STATUTS.map(st => <option key={st} value={st}>{STATUT_LABELS[st]}</option>)}
                    </select>

                    {/* Infos */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{formatDateFRLocal(s.date_seance)}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        ⏱ {s.duree_minutes} min
                        {s.notes && <span> • {s.notes}</span>}
                      </div>
                    </div>

                    {/* Supprimer */}
                    <button onClick={() => void onDeleteSeance(s.id)} style={{ background: "#fff", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 8, padding: "5px 8px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

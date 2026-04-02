"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Theme = { id: string; key: string; label: string; icon: string; position: number; active: boolean };
type Phrase = { id: string; theme_key: string; niveau: "A1" | "A2"; fr: string; nl: string; tip: string; position: number };

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

export default function VocalAdminPage() {
  const supabase = createClient();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // Formulaires
  const [newTheme, setNewTheme] = useState({ key: "", label: "", icon: "🎙" });
  const [newPhrase, setNewPhrase] = useState({ niveau: "A1", fr: "", nl: "", tip: "" });

  async function load() {
    setLoading(true);
    const [{ data: th }, { data: ph }] = await Promise.all([
      supabase.from("vocal_themes").select("*").order("position"),
      supabase.from("vocal_phrases").select("*").order("position"),
    ]);
    setThemes(th ?? []);
    setPhrases(ph ?? []);
    if (!activeTheme && th && th.length > 0) setActiveTheme(th[0].key);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(null), 3000); }

  async function addTheme() {
    if (!newTheme.key || !newTheme.label) return;
    const pos = themes.length;
    const { error } = await supabase.from("vocal_themes").insert({ ...newTheme, position: pos });
    if (error) { flash("❌ " + error.message); return; }
    setNewTheme({ key: "", label: "", icon: "🎙" });
    flash("✅ Thème ajouté !");
    await load();
    setActiveTheme(newTheme.key);
  }

  async function deleteTheme(key: string) {
    if (!confirm(`Supprimer le thème "${key}" et toutes ses phrases ?`)) return;
    await supabase.from("vocal_themes").delete().eq("key", key);
    flash("🗑 Thème supprimé");
    setActiveTheme(themes.find(t => t.key !== key)?.key ?? null);
    await load();
  }

  async function addPhrase() {
    if (!activeTheme || !newPhrase.fr || !newPhrase.nl) return;
    const pos = phrases.filter(p => p.theme_key === activeTheme).length;
    const { error } = await supabase.from("vocal_phrases").insert({
      theme_key: activeTheme, ...newPhrase, position: pos,
    });
    if (error) { flash("❌ " + error.message); return; }
    setNewPhrase({ niveau: "A1", fr: "", nl: "", tip: "" });
    flash("✅ Phrase ajoutée !");
    await load();
  }

  async function deletePhrase(id: string) {
    await supabase.from("vocal_phrases").delete().eq("id", id);
    flash("🗑 Phrase supprimée");
    await load();
  }

  const activePhrases = phrases.filter(p => p.theme_key === activeTheme);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", fontSize: 16, color: "#64748b" }}>
      Chargement…
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#0f172a", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚙️</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>Admin — Module Vocal</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Gérer les thèmes et phrases</div>
          </div>
        </div>
        <a href="/vocal" style={{ fontSize: 13, color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}>← Retour au module</a>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith("❌") ? "#fef2f2" : "#f0fdf4", color: msg.startsWith("❌") ? "#dc2626" : "#166534",
          padding: "10px 24px", fontSize: 14, fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>
          {msg}
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", gap: 20 }}>

        {/* Colonne gauche : thèmes */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0", marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: "#0f172a" }}>Thèmes</div>
            {themes.map(t => (
              <div key={t.key} onClick={() => setActiveTheme(t.key)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 12px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
                background: activeTheme === t.key ? "#eff6ff" : "#f8fafc",
                border: `2px solid ${activeTheme === t.key ? "#0A84FF" : "#e2e8f0"}`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{t.icon} {t.label}</span>
                <button onClick={e => { e.stopPropagation(); deleteTheme(t.key); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#ef4444", padding: "0 4px" }}>🗑</button>
              </div>
            ))}
          </div>

          {/* Formulaire nouveau thème */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#0f172a" }}>+ Nouveau thème</div>
            <input placeholder="Clé (ex: meteo)" value={newTheme.key}
              onChange={e => setNewTheme(p => ({ ...p, key: e.target.value.toLowerCase().replace(/\s/g, "_") }))}
              style={inputStyle} />
            <input placeholder="Label (ex: La météo)" value={newTheme.label}
              onChange={e => setNewTheme(p => ({ ...p, label: e.target.value }))}
              style={inputStyle} />
            <input placeholder="Icône (emoji)" value={newTheme.icon}
              onChange={e => setNewTheme(p => ({ ...p, icon: e.target.value }))}
              style={{ ...inputStyle, width: 60 }} />
            <button onClick={addTheme} style={btnStyle}>Ajouter le thème</button>
          </div>
        </div>

        {/* Colonne droite : phrases */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTheme && (
            <>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 14 }}>
                {themes.find(t => t.key === activeTheme)?.icon} {themes.find(t => t.key === activeTheme)?.label}
                <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b", marginLeft: 8 }}>({activePhrases.length} phrases)</span>
              </div>

              {/* Liste phrases */}
              {activePhrases.map(p => (
                <div key={p.id} style={{
                  background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                  border: "1px solid #e2e8f0", display: "flex", alignItems: "flex-start", gap: 12,
                }}>
                  <span style={{
                    padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0,
                    background: p.niveau === "A1" ? "#dcfce7" : "#fef3c7",
                    color: p.niveau === "A1" ? "#166534" : "#92400e",
                  }}>{p.niveau}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{p.nl}</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>{p.fr}</div>
                    {p.tip && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>💡 {p.tip}</div>}
                  </div>
                  <button onClick={() => deletePhrase(p.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#ef4444", flexShrink: 0 }}>🗑</button>
                </div>
              ))}

              {/* Formulaire nouvelle phrase */}
              <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "2px dashed #bae6fd", marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#0369a1" }}>+ Nouvelle phrase</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {(["A1", "A2"] as const).map(n => (
                    <button key={n} onClick={() => setNewPhrase(p => ({ ...p, niveau: n }))} style={{
                      padding: "6px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
                      background: newPhrase.niveau === n ? (n === "A1" ? "#dcfce7" : "#fef3c7") : "#f1f5f9",
                      color: newPhrase.niveau === n ? (n === "A1" ? "#166534" : "#92400e") : "#64748b",
                    }}>{n}</button>
                  ))}
                </div>
                <input placeholder="Traduction française" value={newPhrase.fr}
                  onChange={e => setNewPhrase(p => ({ ...p, fr: e.target.value }))} style={inputStyle} />
                <input placeholder="Phrase en néerlandais" value={newPhrase.nl}
                  onChange={e => setNewPhrase(p => ({ ...p, nl: e.target.value }))} style={inputStyle} />
                <input placeholder="Conseil de prononciation (optionnel)" value={newPhrase.tip}
                  onChange={e => setNewPhrase(p => ({ ...p, tip: e.target.value }))} style={inputStyle} />
                <button onClick={addPhrase} style={btnStyle}>Ajouter la phrase</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0",
  fontSize: 13, marginBottom: 8, boxSizing: "border-box", outline: "none",
};
const btnStyle: React.CSSProperties = {
  width: "100%", padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
  background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)",
  color: "#fff", fontWeight: 700, fontSize: 14, marginTop: 4,
};

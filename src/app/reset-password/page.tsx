"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setMsgType("error"); setMsg("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 6) { setMsgType("error"); setMsg("Le mot de passe doit faire au moins 6 caractères."); return; }
    setLoading(true); setMsg("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setMsgType("error"); setMsg(error.message); return; }
    setMsgType("success");
    setMsg("Mot de passe mis à jour ✓");
    setDone(true);
    setTimeout(() => { window.location.href = "/dashboard"; }, 2000);
  }

  const GRAD = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

  return (
    <main style={{ minHeight: "100vh", background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 48, width: "100%", maxWidth: 400, boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 8px" }}>
          Klasbook
        </h1>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>Nouveau mot de passe</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Choisis un nouveau mot de passe pour ton compte.</p>

        {!done ? (
          <form onSubmit={handleReset}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Nouveau mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6}
                style={{ width: "100%", padding: 12, border: "2px solid #e5e7eb", borderRadius: 8, fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Confirmer le mot de passe</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required minLength={6}
                style={{ width: "100%", padding: 12, border: "2px solid #e5e7eb", borderRadius: 8, fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: 14, background: loading ? "#c4b5fd" : GRAD, color: "white", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Mise à jour…" : "Enregistrer le mot de passe"}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 700, color: "#166534" }}>Mot de passe mis à jour !</p>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Redirection vers le tableau de bord…</p>
          </div>
        )}

        {msg && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: msgType === "error" ? "#fef2f2" : "#f0fdf4", color: msgType === "error" ? "#dc2626" : "#16a34a", fontSize: "0.85rem", textAlign: "center" }}>
            {msg}
          </div>
        )}
      </div>
    </main>
  );
}

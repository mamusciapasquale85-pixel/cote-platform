"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); setMsgType("error"); setMsg("Email ou mot de passe incorrect."); return; }
    const { data: school } = await supabase.from("schools").select("id").limit(1).maybeSingle();
    setLoading(false);
    window.location.href = school ? "/dashboard" : "/onboarding";
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    setLoading(false);
    if (error) { setMsgType("error"); setMsg(error.message); return; }
    if (data.user) {
      await supabase.from("user_profiles").upsert({ id: data.user.id, full_name: fullName, display_role: "teacher", locale: "fr" });
    }
    setMsgType("success");
    setMsg("Compte créé ! Vérifiez votre email pour confirmer.");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setMsgType("error"); setMsg("Entre ton adresse email."); return; }
    setMsg(""); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setMsgType("error"); setMsg(error.message); return; }
    setMsgType("success");
    setMsg("Email envoyé ! Vérifie ta boîte mail et clique sur le lien pour réinitialiser ton mot de passe.");
  }

  const GRAD = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

  return (
    <main style={{ minHeight: "100vh", background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 48, width: "100%", maxWidth: 420, boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
            Klasbook
          </h1>
          <p style={{ color: "#6b7280", marginTop: 8, fontSize: "0.9rem" }}>La gestion de classe simplifiée</p>
        </div>

        {/* Tabs login/register — masqués en mode forgot */}
        {mode !== "forgot" && (
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 28 }}>
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setMsg(""); }}
                style={{ flex: 1, padding: 10, border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", transition: "all 0.2s", background: mode === m ? "white" : "transparent", color: mode === m ? "#667eea" : "#6b7280", boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.1)" : "none" }}>
                {m === "login" ? "Se connecter" : "Créer un compte"}
              </button>
            ))}
          </div>
        )}

        {/* ── Mode : Mot de passe oublié ── */}
        {mode === "forgot" && (
          <>
            <button onClick={() => { setMode("login"); setMsg(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
              ← Retour à la connexion
            </button>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111827", margin: "0 0 6px" }}>Mot de passe oublié</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Entre ton adresse email — on t'envoie un lien pour réinitialiser ton mot de passe.</p>
            <form onSubmit={handleForgotPassword}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="prof@ecole.be" required
                  style={{ width: "100%", padding: 12, border: "2px solid #e5e7eb", borderRadius: 8, fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
              </div>
              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: 14, background: loading ? "#c4b5fd" : GRAD, color: "white", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Envoi…" : "Envoyer le lien"}
              </button>
            </form>
          </>
        )}

        {/* ── Mode : Login / Register ── */}
        {mode !== "forgot" && (
          <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
            {mode === "register" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Nom complet</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jean Dupont" required
                  style={{ width: "100%", padding: 12, border: "2px solid #e5e7eb", borderRadius: 8, fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="prof@ecole.be" required
                style={{ width: "100%", padding: 12, border: "2px solid #e5e7eb", borderRadius: 8, fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: mode === "login" ? 8 : 24 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6}
                style={{ width: "100%", padding: 12, border: "2px solid #e5e7eb", borderRadius: 8, fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
            </div>

            {/* Lien mot de passe oublié — seulement en mode login */}
            {mode === "login" && (
              <div style={{ textAlign: "right", marginBottom: 20 }}>
                <button type="button" onClick={() => { setMode("forgot"); setMsg(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#667eea", fontSize: 13, fontWeight: 600, padding: 0 }}>
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: 14, background: loading ? "#c4b5fd" : GRAD, color: "white", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Chargement…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>
        )}

        {/* Message feedback */}
        {msg && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: msgType === "error" ? "#fef2f2" : "#f0fdf4", color: msgType === "error" ? "#dc2626" : "#16a34a", fontSize: "0.85rem", textAlign: "center" }}>
            {msg}
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.75rem", color: "#9ca3af" }}>
          LYCÉE ALTERNATIF BRUXELLOIS · LAB Marie Curie
        </p>
      </div>
    </main>
  );
}

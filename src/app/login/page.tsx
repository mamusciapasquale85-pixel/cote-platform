"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
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
    setMsg("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setMsgType("error");
      setMsg("Email ou mot de passe incorrect.");
      return;
    }
    const { data: school } = await supabase
      .from("schools")
      .select("id")
      .limit(1)
      .maybeSingle();
    setLoading(false);
    window.location.href = school ? "/teacher" : "/onboarding";
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    setLoading(false);
    if (error) { setMsgType("error"); setMsg(error.message); return; }
    if (data.user) {
      await supabase.from("user_profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        display_role: "teacher",
        locale: "fr"
      });
    }
    setMsgType("success");
    setMsg("Compte créé ! Vérifiez votre email pour confirmer.");
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        padding: "48px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 25px 50px rgba(0,0,0,0.2)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{
            fontSize: "2rem",
            fontWeight: "800",
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: 0
          }}>
            Cotefacile
          </h1>
          <p style={{ color: "#6b7280", marginTop: "8px", fontSize: "0.9rem" }}>
            La gestion de classe simplifiée
          </p>
        </div>

        <div style={{
          display: "flex",
          background: "#f3f4f6",
          borderRadius: "10px",
          padding: "4px",
          marginBottom: "28px"
        }}>
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setMsg(""); }}
              style={{
                flex: 1,
                padding: "10px",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.85rem",
                transition: "all 0.2s",
                background: mode === m ? "white" : "transparent",
                color: mode === m ? "#667eea" : "#6b7280",
                boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.1)" : "none"
              }}
            >
              {m === "login" ? "Se connecter" : "Créer un compte"}
            </button>
          ))}
        </div>

        <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
          {mode === "register" && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                Nom complet
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jean Dupont"
                required
                style={{ width: "100%", padding: "12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prof@ecole.be"
              required
              style={{ width: "100%", padding: "12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={{ width: "100%", padding: "12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: loading ? "#c4b5fd" : "linear-gradient(135deg, #667eea, #764ba2)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Chargement..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>

        {msg && (
          <div style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: "8px",
            background: msgType === "error" ? "#fef2f2" : "#f0fdf4",
            color: msgType === "error" ? "#dc2626" : "#16a34a",
            fontSize: "0.85rem",
            textAlign: "center"
          }}>
            {msg}
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "0.75rem", color: "#9ca3af" }}>
          LYCÉE ALTERNATIF BRUXELLOIS · LAB Marie Curie
        </p>
      </div>
    </main>
  );
}
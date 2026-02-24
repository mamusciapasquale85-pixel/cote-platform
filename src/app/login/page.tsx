"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    window.location.href = "/teacher";
  }

  return (
    <main style={{ maxWidth: "400px", margin: "60px auto" }}>
      <h1>Connexion</h1>

      <form onSubmit={handleLogin}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", marginTop: 8 }}
          />
        </label>

        <label style={{ display: "block", marginTop: 16 }}>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", marginTop: 8 }}
          />
        </label>

        <button type="submit" style={{ marginTop: 20 }} disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      {msg && <p style={{ color: "tomato", marginTop: 20 }}>{msg}</p>}
    </main>
  );
}
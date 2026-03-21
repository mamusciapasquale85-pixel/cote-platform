"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "form" | "success" | "error">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase envoie le token dans le hash (#access_token=...) ou en query param
    // On vérifie si on a déjà une session (invite flow de Supabase)
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setStatus("form");
      } else {
        // Pas de session : peut-être que le token n'est pas encore traité
        // On attend un court instant et on réessaie
        setTimeout(async () => {
          const { data: { session: s2 } } = await supabase.auth.getSession();
          if (s2?.user?.email) {
            setEmail(s2.user.email);
            setStatus("form");
          } else {
            setStatus("error");
            setErrorMsg("Lien d'invitation invalide ou expiré. Contactez votre enseignant pour recevoir un nouvel email.");
          }
        }, 1500);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus("success");
      setTimeout(() => router.push("/parent"), 2500);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Une erreur est survenue. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  const card: React.CSSProperties = {
    background: "white",
    borderRadius: 20,
    padding: "36px 32px",
    boxShadow: "0 20px 60px rgba(15,23,42,0.14)",
    width: "min(480px, 94vw)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.2)",
    fontSize: 15,
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 6,
    display: "block",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: GRADIENT,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{
          fontSize: 30, fontWeight: 900, color: "white",
          letterSpacing: "-0.5px", textShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}>
          📚 Klasbook
        </div>
        <div style={{ color: "rgba(255,255,255,0.8)", marginTop: 4, fontSize: 14 }}>
          Portail Parents
        </div>
      </div>

      <div style={card}>
        {/* ── LOADING ── */}
        {status === "loading" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>Vérification de l'invitation…</div>
            <div style={{ marginTop: 8, opacity: 0.6, fontSize: 14 }}>Quelques instants</div>
          </div>
        )}

        {/* ── FORM ── */}
        {status === "form" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
              🎉 Bienvenue sur Klasbook !
            </div>
            <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 24 }}>
              Choisissez un mot de passe pour activer votre compte parent.
            </div>

            {email && (
              <div style={{
                background: "rgba(10,132,255,0.07)", borderRadius: 10,
                padding: "10px 14px", marginBottom: 20,
                fontSize: 13, color: "#0A63BF", fontWeight: 600,
              }}>
                📧 {email}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Mot de passe</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minimum 8 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Confirmer le mot de passe</label>
                <input
                  type="password"
                  required
                  placeholder="Répétez le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {errorMsg && (
                <div style={{
                  background: "rgba(220,38,38,0.08)", borderRadius: 10,
                  padding: "10px 14px", color: "#991B1B", fontSize: 13, fontWeight: 600,
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "13px 0",
                  borderRadius: 12,
                  border: "none",
                  background: GRADIENT,
                  color: "white",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                  transition: "opacity 150ms",
                }}
              >
                {submitting ? "Activation…" : "✅ Activer mon compte"}
              </button>
            </form>
          </>
        )}

        {/* ── SUCCESS ── */}
        {status === "success" && (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎊</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
              Compte activé !
            </div>
            <div style={{ opacity: 0.7, fontSize: 14 }}>
              Redirection vers votre espace parent…
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === "error" && (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
              Lien invalide
            </div>
            <div style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.6 }}>
              {errorMsg}
            </div>
            <button
              onClick={() => router.push("/login")}
              style={{
                marginTop: 20, padding: "11px 24px", borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.2)", background: "white",
                cursor: "pointer", fontWeight: 700, fontSize: 14,
              }}
            >
              Aller à la connexion
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center" }}>
        Besoin d'aide ? Contactez l'école de votre enfant.
      </div>
    </div>
  );
}

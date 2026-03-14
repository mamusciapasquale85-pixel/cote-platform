"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Step = 1 | 2 | 3;

const GRADE_OPTIONS = [
  { label: "1ère primaire", value: 1 },
  { label: "2ème primaire", value: 2 },
  { label: "3ème primaire", value: 3 },
  { label: "4ème primaire", value: 4 },
  { label: "5ème primaire", value: 5 },
  { label: "6ème primaire", value: 6 },
  { label: "1ère secondaire", value: 7 },
  { label: "2ème secondaire", value: 8 },
  { label: "3ème secondaire", value: 9 },
  { label: "4ème secondaire", value: 10 },
  { label: "5ème secondaire", value: 11 },
  { label: "6ème secondaire", value: 12 },
];

const GRADIENT = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");

      // 1. Mettre à jour le profil
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert({ id: user.id, full_name: fullName, display_role: "teacher", locale: "fr" });
      if (profileError) throw profileError;

      // 2. Créer l'école
      const { data: school, error: schoolError } = await supabase
        .from("schools")
        .insert({ name: schoolName })
        .select("id")
        .single();
      if (schoolError) throw schoolError;

      // 3. Rattacher l'enseignant à l'école en tant qu'admin
      const { error: memberError } = await supabase
        .from("school_memberships")
        .insert({ school_id: school.id, user_id: user.id, role: "admin", status: "active" });
      if (memberError) throw memberError;

      // 4. Créer l'année scolaire en cours (2025-2026)
      const { data: year, error: yearError } = await supabase
        .from("academic_years")
        .insert({ school_id: school.id, name: "2025-2026", start_date: "2025-09-01", end_date: "2026-06-30" })
        .select("id")
        .single();
      if (yearError) throw yearError;

      // 5. Créer la première classe
      const { error: classError } = await supabase
        .from("class_groups")
        .insert({
          school_id: school.id,
          academic_year_id: year.id,
          name: className,
          grade_level: gradeLevel,
          teacher_id: user.id,
        });
      if (classError) throw classError;

      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: GRADIENT,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: "24px",
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        padding: "48px",
        width: "100%",
        maxWidth: "460px",
        boxShadow: "0 25px 50px rgba(0,0,0,0.2)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{
            fontSize: "2rem",
            fontWeight: "800",
            background: GRADIENT,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: 0,
          }}>
            Cotefacile
          </h1>
          <p style={{ color: "#6b7280", marginTop: "6px", fontSize: "0.9rem" }}>
            Configuration de votre espace
          </p>
        </div>

        {/* Indicateur d'étapes */}
        <StepIndicator current={step} />

        {/* Étape 1 */}
        {step === 1 && (
          <form onSubmit={handleStep1}>
            <SectionTitle>Qui êtes-vous ?</SectionTitle>
            <Field label="Votre nom complet">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Marie Dupont"
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Nom de votre école">
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Institut Marie Curie"
                required
                style={inputStyle}
              />
            </Field>
            <SubmitButton loading={false}>Continuer →</SubmitButton>
          </form>
        )}

        {/* Étape 2 */}
        {step === 2 && (
          <form onSubmit={handleStep2}>
            <SectionTitle>Votre première classe</SectionTitle>
            <Field label="Nom de la classe">
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="3B, Maths avancés, …"
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Niveau">
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(Number(e.target.value))}
                required
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {GRADE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>

            {error && (
              <div style={{
                marginBottom: "16px",
                padding: "12px",
                borderRadius: "8px",
                background: "#fef2f2",
                color: "#dc2626",
                fontSize: "0.85rem",
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                ← Retour
              </button>
              <SubmitButton loading={loading} style={{ flex: 2 }}>
                {loading ? "Création..." : "Créer ma classe"}
              </SubmitButton>
            </div>
          </form>
        )}

        {/* Étape 3 */}
        {step === 3 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🎉</div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#111827", margin: "0 0 12px" }}>
              C'est parti !
            </h2>
            <p style={{ color: "#6b7280", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "32px" }}>
              Votre espace est prêt. Vous pouvez maintenant gérer vos élèves,
              planifier vos cours et encoder vos évaluations.
            </p>
            <button
              onClick={() => { window.location.href = "/teacher"; }}
              style={{
                width: "100%",
                padding: "14px",
                background: GRADIENT,
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Accéder à mon espace →
            </button>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: "28px", fontSize: "0.75rem", color: "#9ca3af" }}>
          LYCÉE ALTERNATIF BRUXELLOIS · LAB Marie Curie
        </p>
      </div>
    </main>
  );
}

/* ── Sous-composants ── */

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "Mon profil" },
    { n: 2, label: "Ma classe" },
    { n: 3, label: "Confirmation" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.8rem",
              fontWeight: "700",
              background: current >= s.n ? "linear-gradient(135deg, #667eea, #764ba2)" : "#e5e7eb",
              color: current >= s.n ? "white" : "#9ca3af",
              transition: "all 0.3s",
            }}>
              {current > s.n ? "✓" : s.n}
            </div>
            <span style={{ fontSize: "0.65rem", color: current >= s.n ? "#667eea" : "#9ca3af", fontWeight: "600", whiteSpace: "nowrap" }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1,
              height: "2px",
              background: current > s.n ? "linear-gradient(90deg, #667eea, #764ba2)" : "#e5e7eb",
              margin: "0 8px",
              marginBottom: "16px",
              transition: "background 0.3s",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: "1.15rem", fontWeight: "700", color: "#111827", marginBottom: "20px", marginTop: 0 }}>
      {children}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SubmitButton({ children, loading, style }: {
  children: React.ReactNode;
  loading: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: "100%",
        padding: "14px",
        background: loading ? "#c4b5fd" : GRADIENT,
        color: "white",
        border: "none",
        borderRadius: "8px",
        fontSize: "1rem",
        fontWeight: "700",
        cursor: loading ? "not-allowed" : "pointer",
        transition: "opacity 0.2s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "2px solid #e5e7eb",
  borderRadius: "8px",
  fontSize: "0.95rem",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
  background: "white",
};

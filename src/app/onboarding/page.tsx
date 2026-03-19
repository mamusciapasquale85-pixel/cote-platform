"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3 | 4;
type Role = "teacher" | "admin" | "parent";

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

const ROLES: { value: Role; label: string; description: string; icon: string }[] = [
  { value: "teacher", label: "Enseignant(e)", description: "Gérer mes classes et évaluations", icon: "📚" },
  { value: "admin", label: "Direction", description: "Accès complet à l'établissement", icon: "🏫" },
  { value: "parent", label: "Parent", description: "Suivre les résultats de mon enfant", icon: "👨‍👩‍👧" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("teacher");
  const [schoolName, setSchoolName] = useState("");
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState(7);
  const [childFirstName, setChildFirstName] = useState("");
  const [childLastName, setChildLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setStep(role === "parent" ? 3 : 2);
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");

      await supabase.from("user_profiles").upsert({
        id: user.id, full_name: fullName, display_role: role, locale: "fr",
      });

      let school: { id: string } | null = null;
      const { data: existing } = await supabase.from("schools").select("id").ilike("name", schoolName.trim()).single();
      if (existing) {
        school = existing;
      } else {
        const { data: newSchool, error: se } = await supabase.from("schools").insert({ name: schoolName.trim() }).select("id").single();
        if (se) throw se;
        school = newSchool;
      }

      await supabase.from("school_memberships").insert({ school_id: school!.id, user_id: user.id, role });

      const { data: year } = await supabase.from("academic_years").select("id").eq("school_id", school!.id).single();
      let yearId = year?.id;
      if (!yearId) {
        const { data: newYear } = await supabase.from("academic_years")
          .insert({ school_id: school!.id, name: "2025-2026", start_date: "2025-09-01", end_date: "2026-06-30" })
          .select("id").single();
        yearId = newYear?.id;
      }

      if (role === "teacher" && className.trim() && yearId) {
        await supabase.from("class_groups").insert({
          school_id: school!.id, academic_year_id: yearId,
          name: className.trim(), grade_level: gradeLevel, teacher_id: user.id,
        });
      }

      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");

      await supabase.from("user_profiles").upsert({
        id: user.id, full_name: fullName, display_role: "parent", locale: "fr",
      });

      const { data: school } = await supabase.from("schools").select("id").ilike("name", schoolName.trim()).single();
      if (!school) throw new Error("École introuvable. Vérifiez le nom exact de l'établissement.");

      await supabase.from("school_memberships").insert({ school_id: school.id, user_id: user.id, role: "parent" });

      const { data: student } = await supabase.from("students").select("id")
        .ilike("first_name", childFirstName.trim()).ilike("last_name", childLastName.trim()).single();
      if (!student) throw new Error("Enfant introuvable. Vérifiez le prénom et nom exact.");

      await supabase.from("parent_links").insert({
        school_id: school.id, parent_user_id: user.id,
        student_id: student.id, relationship: "parent", visibility_level: "full",
      });

      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  function goToApp() {
    if (role === "admin") router.push("/admin");
    else if (role === "parent") router.push("/parent");
    else router.push("/teacher");
  }

  return (
    <main style={{ minHeight: "100vh", background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: "24px" }}>
      <div style={{ background: "white", borderRadius: "16px", padding: "48px", width: "100%", maxWidth: "480px", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: "800", background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
            Klasbook
          </h1>
          <p style={{ color: "#6b7280", marginTop: "6px", fontSize: "0.9rem" }}>Configuration de votre espace</p>
        </div>

        {/* Étape 1 : nom + rôle */}
        {step === 1 && (
          <form onSubmit={handleStep1}>
            <SectionTitle>Qui êtes-vous ?</SectionTitle>
            <Field label="Votre nom complet">
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Marie Dupont" required style={inputStyle} />
            </Field>
            <Field label="Votre rôle">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {ROLES.map(r => (
                  <button key={r.value} type="button" onClick={() => setRole(r.value)} style={{
                    display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px",
                    border: role === r.value ? "2px solid #667eea" : "2px solid #e5e7eb",
                    borderRadius: "10px", background: role === r.value ? "#f5f3ff" : "white",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: "1.6rem" }}>{r.icon}</span>
                    <div>
                      <div style={{ fontWeight: "700", color: "#111827", fontSize: "0.95rem" }}>{r.label}</div>
                      <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "2px" }}>{r.description}</div>
                    </div>
                    {role === r.value && <span style={{ marginLeft: "auto", color: "#667eea", fontWeight: "700" }}>✓</span>}
                  </button>
                ))}
              </div>
            </Field>
            <SubmitButton loading={false} style={{ marginTop: "24px" }}>Continuer →</SubmitButton>
          </form>
        )}

        {/* Étape 2 : école + classe (teacher/admin) */}
        {step === 2 && (
          <form onSubmit={handleStep2}>
            <SectionTitle>{role === "admin" ? "Votre établissement" : "Votre école et classe"}</SectionTitle>
            <Field label="Nom de l'établissement">
              <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Institut Marie Curie" required style={inputStyle} />
            </Field>
            {role === "teacher" && (
              <>
                <Field label="Nom de votre première classe">
                  <input type="text" value={className} onChange={e => setClassName(e.target.value)} placeholder="3B, Néerlandais 1A, …" required style={inputStyle} />
                </Field>
                <Field label="Niveau">
                  <select value={gradeLevel} onChange={e => setGradeLevel(Number(e.target.value))} style={{ ...inputStyle, cursor: "pointer" }}>
                    {GRADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </>
            )}
            {error && <ErrorBox>{error}</ErrorBox>}
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <BackButton onClick={() => setStep(1)} />
              <SubmitButton loading={loading} style={{ flex: 2 }}>{loading ? "Création..." : "Créer mon espace →"}</SubmitButton>
            </div>
          </form>
        )}

        {/* Étape 3 : parent → école + enfant */}
        {step === 3 && (
          <form onSubmit={handleStep3}>
            <SectionTitle>Votre établissement et votre enfant</SectionTitle>
            <Field label="Nom de l'établissement">
              <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Institut Marie Curie" required style={inputStyle} />
            </Field>
            <Field label="Prénom de votre enfant">
              <input type="text" value={childFirstName} onChange={e => setChildFirstName(e.target.value)} placeholder="Emma" required style={inputStyle} />
            </Field>
            <Field label="Nom de famille de votre enfant">
              <input type="text" value={childLastName} onChange={e => setChildLastName(e.target.value)} placeholder="Dupont" required style={inputStyle} />
            </Field>
            <p style={{ fontSize: "0.8rem", color: "#9ca3af", margin: "0 0 16px" }}>
              Le prénom et nom doivent correspondre exactement à ceux enregistrés par l'école.
            </p>
            {error && <ErrorBox>{error}</ErrorBox>}
            <div style={{ display: "flex", gap: "12px" }}>
              <BackButton onClick={() => setStep(1)} />
              <SubmitButton loading={loading} style={{ flex: 2 }}>{loading ? "Recherche..." : "Accéder à mon espace →"}</SubmitButton>
            </div>
          </form>
        )}

        {/* Étape 4 : confirmation */}
        {step === 4 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🎉</div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#111827", margin: "0 0 12px" }}>C'est parti !</h2>
            <p style={{ color: "#6b7280", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "32px" }}>
              {role === "parent" ? "Votre espace est prêt. Vous pouvez suivre les résultats de votre enfant."
                : role === "admin" ? "Votre espace est prêt. Vous avez accès à l'ensemble de l'établissement."
                : "Votre espace est prêt. Vous pouvez gérer vos classes et évaluations."}
            </p>
            <button onClick={goToApp} style={{ width: "100%", padding: "14px", background: GRADIENT, color: "white", border: "none", borderRadius: "8px", fontSize: "1rem", fontWeight: "700", cursor: "pointer" }}>
              Accéder à mon espace →
            </button>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: "28px", fontSize: "0.75rem", color: "#9ca3af" }}>
          Klasbook · La gestion de classe simplifiée
        </p>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: "1.15rem", fontWeight: "700", color: "#111827", marginBottom: "20px", marginTop: 0 }}>{children}</h2>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: "16px", padding: "12px", borderRadius: "8px", background: "#fef2f2", color: "#dc2626", fontSize: "0.85rem" }}>{children}</div>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ flex: 1, padding: "14px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: "8px", fontSize: "0.95rem", fontWeight: "600", cursor: "pointer" }}>← Retour</button>;
}

function SubmitButton({ children, loading, style }: { children: React.ReactNode; loading: boolean; style?: React.CSSProperties }) {
  return (
    <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "#c4b5fd" : GRADIENT, color: "white", border: "none", borderRadius: "8px", fontSize: "1rem", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", ...style }}>
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "0.95rem", outline: "none", boxSizing: "border-box", background: "white" };

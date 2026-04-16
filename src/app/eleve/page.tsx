"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

type Resultat = {
  id: string;
  assessment_title: string;
  assessment_date: string | null;
  note: string | null;
  matiere: string | null;
  comment: string | null;
};

type Remediation = {
  id: string;
  attendu: string | null;
  statut: string;
  type_remediation: string | null;
  created_at: string;
  assessment_title: string | null;
  exercice_propose: Record<string, unknown> | null;
};

type EleveInfo = {
  first_name: string;
  last_name: string;
  class_name: string | null;
};

const NOTE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  TB: { bg: "rgba(48,209,88,0.1)", color: "#166534", border: "rgba(48,209,88,0.3)" },
  B:  { bg: "rgba(10,132,255,0.1)", color: "#0A63BF", border: "rgba(10,132,255,0.3)" },
  S:  { bg: "rgba(255,159,10,0.1)", color: "#B45309", border: "rgba(255,159,10,0.3)" },
  I:  { bg: "rgba(239,68,68,0.1)", color: "#991B1B", border: "rgba(239,68,68,0.3)" },
  NI: { bg: "rgba(239,68,68,0.15)", color: "#7F1D1D", border: "rgba(239,68,68,0.4)" },
};

const STATUT_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  Proposee:  { bg: "rgba(245,158,11,0.1)", color: "#B45309", label: "Proposée" },
  "En cours":{ bg: "rgba(10,132,255,0.1)", color: "#0A63BF", label: "En cours" },
  Terminee:  { bg: "rgba(34,197,94,0.1)",  color: "#166534", label: "Terminée" },
};

export default function ElevePage() {
  const supabase = createClient();
  const router = useRouter();
  const [eleve, setEleve] = useState<EleveInfo | null>(null);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [remediations, setRemediations] = useState<Remediation[]>([]);
  const [tab, setTab] = useState<"resultats" | "remediations">("resultats");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("template_json")
        .eq("id", user.id)
        .maybeSingle();

      const studentId = profile?.template_json?.student_id as string | undefined;
      if (!studentId) {
        setError("Profil élève introuvable. Contacte ton professeur.");
        setLoading(false);
        return;
      }

      const { data: studentData } = await supabase
        .from("students")
        .select("first_name, last_name")
        .eq("id", studentId)
        .maybeSingle();

      const { data: enrollment } = await supabase
        .from("student_enrollments")
        .select("class_groups(name)")
        .eq("student_id", studentId)
        .limit(1)
        .maybeSingle();

      setEleve({
        first_name: studentData?.first_name ?? "",
        last_name: studentData?.last_name ?? "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        class_name: (enrollment as any)?.class_groups?.name ?? null,
      });

      const { data: snaps } = await supabase
        .from("competency_snapshots")
        .select(`id, computed_level, computed_at, courses(name), curriculum_nodes(label)`)
        .eq("student_id", studentId)
        .order("computed_at", { ascending: false })
        .limit(30);

      setResultats(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (snaps ?? []).map((s: any) => ({
          id: s.id,
          assessment_title: s.curriculum_nodes?.label ?? "—",
          assessment_date: s.computed_at?.split("T")[0] ?? null,
          note: s.computed_level ?? null,
          matiere: s.courses?.name ?? null,
          comment: null,
        }))
      );

      const { data: rems } = await supabase
        .from("remediations")
        .select(`id, attendu, statut, type_remediation, created_at, exercice_propose, assessments(title)`)
        .eq("eleve_id", studentId)
        .order("created_at", { ascending: false });

      setRemediations(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (rems ?? []).map((r: any) => ({
          id: r.id,
          attendu: r.attendu,
          statut: r.statut,
          type_remediation: r.type_remediation,
          created_at: r.created_at,
          assessment_title: r.assessments?.title ?? null,
          exercice_propose: r.exercice_propose ?? null,
        }))
      );

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui" }}>
      <div style={{ textAlign: "center", color: "#64748b" }}>Chargement…</div>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui" }}>
      <div style={{ background: "#fef2f2", color: "#991B1B", padding: "20px 28px", borderRadius: 12, maxWidth: 400, textAlign: "center" }}>
        ⚠️ {error}
      </div>
    </div>
  );

  const remActives = remediations.filter(r => r.statut !== "Terminee");
  const remTerminees = remediations.filter(r => r.statut === "Terminee");

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: GRADIENT, padding: "24px 24px 28px", color: "#fff" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Mon espace Klasbook</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>👋 Bonjour, {eleve?.first_name} !</div>
          {eleve?.class_name && (
            <div style={{ marginTop: 6, opacity: 0.85, fontSize: 14 }}>🏫 {eleve.class_name}</div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { emoji: "📊", value: resultats.length, label: "Résultats", color: "#0A84FF" },
            { emoji: "🔧", value: remActives.length, label: "Remédiations actives", color: "#FF9F0A" },
            { emoji: "✅", value: remTerminees.length, label: "Terminées", color: "#30D158" },
          ].map(({ emoji, value, label, color }) => (
            <div key={label} style={{ background: "#fff", borderRadius: 14, padding: "16px", border: "1px solid rgba(15,23,42,0.08)", textAlign: "center" }}>
              <div style={{ fontSize: 22 }}>{emoji}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 4 }}>{value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["resultats", "remediations"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "12px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 700,
              background: tab === t ? GRADIENT : "#e2e8f0",
              color: tab === t ? "#fff" : "#64748b",
              transition: "all 0.15s",
            }}>
              {t === "resultats" ? "📊 Mes résultats" : "🔧 Mes remédiations"}
            </button>
          ))}
        </div>

        {tab === "resultats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {resultats.length === 0 ? (
              <EmptyState emoji="📊" text="Aucun résultat enregistré pour le moment." />
            ) : resultats.map(r => {
              const noteStyle = r.note ? (NOTE_COLORS[r.note] ?? NOTE_COLORS["S"]) : null;
              return (
                <div key={r.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", border: "1px solid rgba(15,23,42,0.08)", display: "flex", alignItems: "center", gap: 14 }}>
                  {noteStyle && r.note && (
                    <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 12, background: noteStyle.bg, border: `2px solid ${noteStyle.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: noteStyle.color }}>
                      {r.note}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.assessment_title}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, display: "flex", gap: 8 }}>
                      {r.matiere && <span>📚 {r.matiere}</span>}
                      {r.assessment_date && <span>📅 {new Date(r.assessment_date).toLocaleDateString("fr-BE")}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "remediations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {remediations.length === 0 ? (
              <EmptyState emoji="🎉" text="Aucune remédiation en cours. Bravo !" />
            ) : remediations.map(r => {
              const s = STATUT_STYLES[r.statut] ?? STATUT_STYLES["En cours"];
              return (
                <div key={r.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", border: "1px solid rgba(15,23,42,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", flex: 1 }}>
                      {r.assessment_title ?? r.attendu ?? "Remédiation"}
                    </div>
                    <span style={{ flexShrink: 0, background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                      {s.label}
                    </span>
                  </div>
                  {r.attendu && (
                    <div style={{ fontSize: 13, color: "#475569", marginBottom: 8, lineHeight: 1.5 }}>
                      🎯 {r.attendu}
                    </div>
                  )}
                  {r.type_remediation && (
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      📝 {r.type_remediation} · {new Date(r.created_at).toLocaleDateString("fr-BE")}
                    </div>
                  )}
                  {r.exercice_propose && (
                    <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(10,132,255,0.05)", border: "1px solid rgba(10,132,255,0.15)", fontSize: 13, color: "#0A63BF", fontWeight: 600 }}>
                      💡 Un exercice de remédiation a été préparé pour toi.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{emoji}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{text}</div>
    </div>
  );
}

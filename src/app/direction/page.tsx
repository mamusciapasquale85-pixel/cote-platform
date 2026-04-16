"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

type Stats = {
  nb_eleves: number; nb_classes: number; nb_profs: number;
  nb_evals: number; nb_remediations: number; rem_terminees: number;
};
type Prof = {
  user_id: string; full_name: string | null; matiere: string | null;
  nb_classes: number; nb_eleves: number; nb_remediations: number;
};
type Classe = {
  id: string; name: string; grade_level: number | null;
  teacher_name: string | null; nb_eleves: number; nb_ni: number;
};

export default function DirectionPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [profs, setProfs] = useState<Prof[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [tab, setTab] = useState<"overview" | "classes" | "profs">("overview");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: mem } = await supabase
        .from("school_memberships")
        .select("school_id, schools(name)")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .limit(1).maybeSingle();

      if (!mem?.school_id) {
        setError("Aucun établissement admin trouvé.");
        setLoading(false);
        return;
      }

      const schoolId = mem.school_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSchoolName((mem as any).schools?.name ?? "Mon établissement");

      const [
        { count: nb_eleves }, { count: nb_classes }, { count: nb_profs },
        { count: nb_evals }, { count: nb_remediations }, { count: rem_terminees },
      ] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("class_groups").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("school_memberships").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("role", "teacher"),
        supabase.from("assessments").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("remediations").select("classe_id, class_groups!inner(school_id)", { count: "exact", head: true }).eq("class_groups.school_id", schoolId),
        supabase.from("remediations").select("classe_id, class_groups!inner(school_id)", { count: "exact", head: true }).eq("class_groups.school_id", schoolId).eq("statut", "Terminee"),
      ]);

      setStats({
        nb_eleves: nb_eleves ?? 0, nb_classes: nb_classes ?? 0,
        nb_profs: nb_profs ?? 0, nb_evals: nb_evals ?? 0,
        nb_remediations: nb_remediations ?? 0, rem_terminees: rem_terminees ?? 0,
      });

      const { data: classData } = await supabase
        .from("class_groups")
        .select("id, name, grade_level, teacher_id, user_profiles(full_name)")
        .eq("school_id", schoolId).order("name");

      const classIds = (classData ?? []).map((c: any) => c.id);

      const [{ data: enrollments }, { data: rems }, { data: members }] = await Promise.all([
        supabase.from("student_enrollments").select("class_group_id").in("class_group_id", classIds),
        supabase.from("remediations").select("classe_id").in("classe_id", classIds).eq("statut", "Proposee"),
        supabase.from("school_memberships").select("user_id, matiere, user_profiles(full_name)").eq("school_id", schoolId).eq("role", "teacher"),
      ]);

      setClasses((classData ?? []).map((c: any) => ({
        id: c.id, name: c.name, grade_level: c.grade_level,
        teacher_name: c.user_profiles?.full_name ?? null,
        nb_eleves: (enrollments ?? []).filter(e => e.class_group_id === c.id).length,
        nb_ni: (rems ?? []).filter(r => r.classe_id === c.id).length,
      })));

      setProfs((members ?? []).map((m: any) => {
        const tc = (classData ?? []).filter((c: any) => c.teacher_id === m.user_id);
        const tcIds = tc.map((c: any) => c.id);
        return {
          user_id: m.user_id,
          full_name: m.user_profiles?.full_name ?? null,
          matiere: m.matiere,
          nb_classes: tc.length,
          nb_eleves: (enrollments ?? []).filter(e => tcIds.includes(e.class_group_id)).length,
          nb_remediations: (rems ?? []).filter(r => tcIds.includes(r.classe_id)).length,
        };
      }));

      setLoading(false);
    }
    load().catch(e => { setError(e instanceof Error ? e.message : "Erreur"); setLoading(false); });
  }, []);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", color: "#64748b" }}>Chargement…</div>;
  if (error) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui" }}><div style={{ background: "#fef2f2", color: "#991B1B", padding: "20px 28px", borderRadius: 12 }}>⚠️ {error}</div></div>;

  const tauxRemediation = stats && stats.nb_remediations > 0 ? Math.round((stats.rem_terminees / stats.nb_remediations) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: GRADIENT, padding: "28px 32px 24px", color: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Tableau de bord Direction</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>🏫 {schoolName}</div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 48px" }}>
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
            {[
              { emoji: "👥", value: stats.nb_eleves, label: "Élèves", color: "#0A84FF" },
              { emoji: "🏫", value: stats.nb_classes, label: "Classes", color: "#30D158" },
              { emoji: "👨‍🏫", value: stats.nb_profs, label: "Enseignants", color: "#FF9F0A" },
              { emoji: "📝", value: stats.nb_evals, label: "Évaluations", color: "#636AFF" },
              { emoji: "🔧", value: stats.nb_remediations, label: "Remédiations", color: "#FF3B30" },
              { emoji: "✅", value: `${tauxRemediation}%`, label: "Taux clôture", color: "#22C55E" },
            ].map(({ emoji, value, label, color }) => (
              <div key={label} style={{ background: "#fff", borderRadius: 14, padding: "16px", border: "1px solid rgba(15,23,42,0.08)", textAlign: "center" }}>
                <div style={{ fontSize: 22 }}>{emoji}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 4 }}>{value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {([
            { id: "overview" as const, label: "📊 Vue d'ensemble" },
            { id: "classes" as const, label: `🏫 Classes (${classes.length})` },
            { id: "profs" as const, label: `👨‍🏫 Enseignants (${profs.length})` },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 700,
              background: tab === t.id ? GRADIENT : "#e2e8f0",
              color: tab === t.id ? "#fff" : "#64748b",
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "20px", border: "1px solid rgba(15,23,42,0.08)" }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>🚨 Classes avec remédiations en attente</div>
              {classes.filter(c => c.nb_ni > 0).length === 0
                ? <div style={{ color: "#64748b", fontSize: 14 }}>✅ Aucune remédiation en attente.</div>
                : classes.filter(c => c.nb_ni > 0).sort((a, b) => b.nb_ni - a.nb_ni).map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{c.teacher_name ?? "—"}</div>
                    </div>
                    <span style={{ background: "#ef4444", color: "#fff", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>{c.nb_ni} NI</span>
                  </div>
                ))
              }
            </div>
            <div style={{ background: "#fff", borderRadius: 16, padding: "20px", border: "1px solid rgba(15,23,42,0.08)" }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>📚 Enseignants par matière</div>
              {Object.entries(profs.reduce((acc, p) => {
                const m = p.matiere ?? "Non défini";
                acc[m] = (acc[m] ?? 0) + 1;
                return acc;
              }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).map(([matiere, count]) => (
                <div key={matiere} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6", fontSize: 14 }}>
                  <span>{matiere}</span>
                  <span style={{ fontWeight: 700, color: "#0A84FF" }}>{count} prof{count > 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "classes" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", gap: 12, padding: "10px 18px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
              {["Classe", "Enseignant", "Niveau", "Élèves", "NI"].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {classes.map((c, i) => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", gap: 12, padding: "12px 18px", alignItems: "center", background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{c.teacher_name ?? "—"}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{c.grade_level ? `Année ${c.grade_level}` : "—"}</div>
                <div style={{ fontWeight: 700 }}>{c.nb_eleves}</div>
                <div>{c.nb_ni > 0
                  ? <span style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 800 }}>{c.nb_ni} 🚨</span>
                  : <span style={{ color: "#22c55e", fontWeight: 700 }}>✓</span>
                }</div>
              </div>
            ))}
          </div>
        )}

        {tab === "profs" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", gap: 12, padding: "10px 18px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
              {["Enseignant", "Matière", "Classes", "Élèves", "Remédiations"].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {profs.map((p, i) => (
              <div key={p.user_id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", gap: 12, padding: "12px 18px", alignItems: "center", background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                    {(p.full_name ?? "?")[0]}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.full_name ?? "Non défini"}</span>
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{p.matiere ?? "—"}</div>
                <div style={{ fontWeight: 700 }}>{p.nb_classes}</div>
                <div style={{ fontWeight: 700 }}>{p.nb_eleves}</div>
                <div>{p.nb_remediations > 0
                  ? <span style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 800 }}>{p.nb_remediations}</span>
                  : <span style={{ color: "#22c55e", fontWeight: 700 }}>✓</span>
                }</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

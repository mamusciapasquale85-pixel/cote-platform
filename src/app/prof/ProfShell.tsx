"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

const NAV_ITEMS = [
  { label: "Accueil", href: "/dashboard", emoji: "🏠" },
  { label: "Planification", href: "/planification", emoji: "N" },
  { label: "Classes", href: "/teacher", emoji: "👥" },
  { label: "Évaluations", href: "/evaluations", emoji: "📋" },
  { label: "Créer une éval.", href: "/creer-evaluation", emoji: "📄" },
  { label: "Historique", href: "/historique", emoji: "📚" },
  { label: "Remédiations", href: "/remediations", emoji: "🔧" },
  { label: "Agenda", href: "/agenda", emoji: "📅" },
  { label: "Générateur IA", href: "/generateur", emoji: "✨" },
  { label: "Outils", href: "/outils", emoji: "🎲" },
  { label: "Import", href: "/import", emoji: "📥" },
];

export default function ProfShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      {/* SIDEBAR */}
      <div style={{
        width: 220, minHeight: "100vh", background: "#0f172a",
        display: "flex", flexDirection: "column", padding: "20px 12px",
        position: "fixed", top: 0, left: 0, zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 28, paddingLeft: 8 }}>
          <div style={{
            fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em",
            background: GRADIENT, WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            ✦ Klasbook
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            La gestion de classe simplifiée
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 10, textDecoration: "none",
                background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                color: isActive ? "#fff" : "#94a3b8",
                fontWeight: isActive ? 700 : 500, fontSize: 14,
                transition: "all 0.15s",
                borderLeft: isActive ? "3px solid #0A84FF" : "3px solid transparent",
              }}>
                <span style={{ fontSize: 16 }}>{item.emoji}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <button onClick={() => void handleLogout()} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 12px", borderRadius: 10, border: "none",
          background: "transparent", color: "#64748b",
          fontWeight: 500, fontSize: 14, cursor: "pointer",
          textAlign: "left", width: "100%",
        }}>
          <span>🚪</span> Déconnexion
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ marginLeft: 220, flex: 1, padding: "24px 28px", minHeight: "100vh" }}>
        {children}
      </div>
    </div>
  );
}

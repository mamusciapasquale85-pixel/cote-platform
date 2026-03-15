"use client";
import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const NAV_ITEMS = [
  { label: "Accueil", icon: "🏠", href: "/dashboard" },
  { label: "Planification", icon: "N", href: "/planification" },
  { label: "Classes", icon: "👥", href: "/classe" },
  { label: "Évaluations", icon: "📝", href: "/evaluations" },
  
  { label: "Remédiations", icon: "🩺", href: "/remediations" },
  { label: "Agenda", icon: "📅", href: "/agenda" },
  { label: "Générateur IA", icon: "✨", href: "/generateur" },
  { label: "Import", icon: "⬆️", href: "/import" },
];

export default function ProfShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push("/login");
  }

  const currentPage = NAV_ITEMS.find(i => pathname === i.href || (i.href !== "/" && pathname?.startsWith(i.href)));

  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FC", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* TOPBAR */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 1px 0 rgba(15,23,42,0.06)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 58, display: "flex", alignItems: "center", gap: 0 }}>

          {/* LOGO */}
          <a href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, marginRight: 32, flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(10,132,255,0.3)",
            }}>
              <span style={{ fontSize: 16, color: "#fff" }}>✦</span>
            </div>
            <span style={{ fontSize: "1.15rem", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em" }}>
              Klasbook
            </span>
          </a>

          {/* NAV LINKS — desktop */}
          <nav style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <a key={item.href} href={item.href} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 8,
                  textDecoration: "none", fontSize: "0.875rem",
                  fontWeight: active ? 700 : 500,
                  color: active ? "#0f172a" : "#64748b",
                  background: active ? "rgba(15,23,42,0.07)" : "transparent",
                  transition: "all 0.15s",
                  position: "relative",
                }}>
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  {item.label}
                  {active && (
                    <span style={{
                      position: "absolute", bottom: -13, left: "50%", transform: "translateX(-50%)",
                      width: 28, height: 2, borderRadius: 2,
                      background: "linear-gradient(90deg, #FF3B30, #0A84FF)",
                    }} />
                  )}
                </a>
              );
            })}
          </nav>

          {/* AVATAR + DÉCONNEXION */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setMenuOpen(v => !v)} style={{
              width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, color: "#fff", fontSize: 14,
              boxShadow: "0 2px 8px rgba(10,132,255,0.3)",
            }}>P</button>

            {menuOpen && (
              <div style={{
                position: "absolute", top: 44, right: 0, zIndex: 200,
                background: "#fff", borderRadius: 12, border: "1px solid rgba(15,23,42,0.1)",
                boxShadow: "0 8px 32px rgba(15,23,42,0.16)", padding: 6, minWidth: 180,
              }}>
                <div style={{ padding: "8px 12px", fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
                  LAB Marie Curie
                </div>
                <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />
                <button onClick={handleLogout} disabled={loggingOut} style={{
                  width: "100%", padding: "9px 12px", borderRadius: 8,
                  border: "none", background: "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: "0.875rem", fontWeight: 600, color: "#ef4444",
                  textAlign: "left",
                }}>
                  🚪 {loggingOut ? "Déconnexion..." : "Se déconnecter"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* BREADCRUMB */}
      {currentPage && (
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>Klasbook</span>
          <span style={{ fontSize: 13, color: "#cbd5e1" }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{currentPage.icon} {currentPage.label}</span>
        </div>
      )}

      {/* CONTENT */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 24px 48px" }}>
        {children}
      </main>

      {/* Click outside to close menu */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 150 }} />
      )}
    </div>
  );
}

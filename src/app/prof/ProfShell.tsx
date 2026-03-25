"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type NavItem = { label: string; icon: string; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil",       icon: "🏠", href: "/dashboard" },
  { label: "Agenda",        icon: "📅", href: "/agenda" },
  { label: "Absences",      icon: "📋", href: "/absences" },
  { label: "Classes",       icon: "👥", href: "/classe" },
  { label: "Évaluations",   icon: "📝", href: "/evaluations" },
  { label: "Compétences",   icon: "🎯", href: "/competences" },
  { label: "Bulletins",     icon: "📄", href: "/bulletins" },
  { label: "Remédiations",  icon: "🩺", href: "/remediations" },
  { label: "Outils",        icon: "🎲", href: "/outils" },
  { label: "Générateur IA", icon: "✨", href: "/generateur" },
  { label: "Historique",    icon: "📚", href: "/historique" },
];

export default function ProfShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname?.startsWith(href));
  }

  const currentPage = NAV_ITEMS.find(i => isActive(i.href));

  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FC", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 1px 0 rgba(15,23,42,0.06)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 58, display: "flex", alignItems: "center" }}>

          {/* LOGO */}
          <a href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, marginRight: 32, flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(10,132,255,0.3)",
            }}>
              <span style={{ fontSize: 16, color: "#fff" }}>✦</span>
            </div>
            <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em" }}>
              Klasbook
            </span>
          </a>

          {/* NAV desktop */}
          {!isMobile && (
            <nav style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, overflowX: "auto" }}>
              {NAV_ITEMS.map(item => {
                const active = isActive(item.href);
                return (
                  <a key={item.href} href={item.href} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 10px", borderRadius: 8,
                    textDecoration: "none", fontSize: "0.82rem",
                    fontWeight: active ? 700 : 500,
                    color: active ? "#0f172a" : "#64748b",
                    background: active ? "rgba(15,23,42,0.07)" : "transparent",
                    whiteSpace: "nowrap", flexShrink: 0,
                    borderBottom: active ? "2px solid #0A84FF" : "2px solid transparent",
                  }}>
                    <span style={{ fontSize: 13 }}>{item.icon}</span>
                    {item.label}
                  </a>
                );
              })}
            </nav>
          )}

          {/* Hamburger mobile */}
          {isMobile && (
            <div style={{ flex: 1 }}>
              <button onClick={() => setMobileNavOpen(v => !v)} style={{
                border: "none", background: "transparent", cursor: "pointer",
                padding: "6px 10px", borderRadius: 8, fontSize: 20, color: "#0f172a",
              }}>
                {mobileNavOpen ? "✕" : "☰"}
              </button>
            </div>
          )}

          {/* AVATAR */}
          <div style={{ position: "relative", flexShrink: 0, marginLeft: 12 }}>
            <button onClick={() => setMenuOpen(v => !v)} style={{
              width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, color: "#fff", fontSize: 14,
            }}>P</button>
            {menuOpen && (
              <div style={{
                position: "absolute", top: 44, right: 0, zIndex: 200,
                background: "#fff", borderRadius: 12, border: "1px solid rgba(15,23,42,0.1)",
                boxShadow: "0 8px 32px rgba(15,23,42,0.16)", padding: 6, minWidth: 180,
              }}>
                <div style={{ padding: "8px 12px", fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>LAB Marie Curie</div>
                <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />
                <a href="/import" onClick={() => setMenuOpen(false)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8,
                  textDecoration: "none", fontSize: "0.875rem", fontWeight: 500, color: "#334155",
                }}>📥 Import</a>
                <button onClick={handleLogout} disabled={loggingOut} style={{
                  width: "100%", padding: "9px 12px", borderRadius: 8,
                  border: "none", background: "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: "0.875rem", fontWeight: 600, color: "#ef4444", textAlign: "left",
                }}>
                  🚪 {loggingOut ? "Déconnexion..." : "Se déconnecter"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Menu mobile déroulant */}
      {isMobile && mobileNavOpen && (
        <div style={{
          position: "fixed", top: 58, left: 0, right: 0, zIndex: 99,
          background: "#fff", borderBottom: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
          padding: "8px 12px 12px",
        }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                borderRadius: 10, textDecoration: "none", fontSize: "0.95rem",
                fontWeight: active ? 800 : 500,
                color: active ? "#0f172a" : "#475569",
                background: active ? "rgba(10,132,255,0.07)" : "transparent",
                borderLeft: active ? "3px solid #0A84FF" : "3px solid transparent",
                marginBottom: 2,
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </div>
      )}

      {currentPage && (
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>Klasbook</span>
          <span style={{ fontSize: 13, color: "#cbd5e1" }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{currentPage.icon} {currentPage.label}</span>
        </div>
      )}

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 24px 48px" }}>
        {children}
      </main>

      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 150 }} />
      )}
      {mobileNavOpen && (
        <div onClick={() => setMobileNavOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 98 }} />
      )}
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type NavChild = { label: string; icon: string; href: string };
type NavItem = {
  label: string;
  icon: string;
  href: string;
  children?: NavChild[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Accueil", icon: "🏠", href: "/dashboard",
    children: [
      { label: "Tableau de bord", icon: "🏠", href: "/dashboard" },
      { label: "Import",          icon: "⬆️", href: "/import" },
    ],
  },
  { label: "Agenda",        icon: "📅", href: "/agenda" },
  { label: "Classes",       icon: "👥", href: "/classe" },
  {
    label: "Évaluations", icon: "📝", href: "/evaluations",
    children: [
      { label: "Mes évaluations",  icon: "📝", href: "/evaluations" },
      { label: "Créer une éval.",  icon: "📄", href: "/creer-evaluation" },
    ],
  },
  { label: "Remédiations",  icon: "🩺", href: "/remediations" },
  { label: "Historique",    icon: "📚", href: "/historique" },
  { label: "Générateur IA", icon: "✨", href: "/generateur" },
  { label: "Outils",        icon: "🎲", href: "/outils" },
];

const ALL_HREFS = NAV_ITEMS.flatMap(item =>
  item.children ? item.children.map(c => ({ ...c })) : [item]
);

export default function ProfShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  function isGroupActive(item: NavItem) {
    if (isActive(item.href)) return true;
    return item.children?.some(c => isActive(c.href)) ?? false;
  }

  const currentPage = ALL_HREFS.find(
    i => pathname === i.href || (i.href !== "/" && pathname?.startsWith(i.href))
  );

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

          {/* NAV LINKS */}
          <nav ref={dropdownRef} style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, flexWrap: "nowrap", overflow: "auto" }}>
            {NAV_ITEMS.map(item => {
              const active = isGroupActive(item);

              if (item.children) {
                const isOpen = openDropdown === item.href;
                return (
                  <div key={item.href} style={{ position: "relative" }}>
                    <button
                      onClick={() => setOpenDropdown(isOpen ? null : item.href)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 10px", borderRadius: 8,
                        border: "none", background: active ? "rgba(15,23,42,0.07)" : "transparent",
                        cursor: "pointer", fontSize: "0.82rem",
                        fontWeight: active ? 700 : 500,
                        color: active ? "#0f172a" : "#64748b",
                        transition: "all 0.15s",
                        whiteSpace: "nowrap", flexShrink: 0,
                        position: "relative",
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{item.icon}</span>
                      {item.label}
                      <span style={{
                        fontSize: 9, marginLeft: 2, opacity: 0.6,
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.15s", display: "inline-block",
                      }}>▼</span>
                      {active && (
                        <span style={{
                          position: "absolute", bottom: -13, left: "50%", transform: "translateX(-50%)",
                          width: 28, height: 2, borderRadius: 2,
                          background: "linear-gradient(90deg, #FF3B30, #0A84FF)",
                        }} />
                      )}
                    </button>

                    {isOpen && (
                      <div style={{
                        position: "absolute", top: "calc(100% + 14px)", left: 0, zIndex: 300,
                        background: "#fff", borderRadius: 12,
                        border: "1px solid rgba(15,23,42,0.1)",
                        boxShadow: "0 8px 32px rgba(15,23,42,0.14)",
                        padding: 6, minWidth: 200,
                      }}>
                        {item.children.map(child => {
                          const childActive = isActive(child.href);
                          return (
                            <a
                              key={child.href}
                              href={child.href}
                              onClick={() => setOpenDropdown(null)}
                              style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "9px 12px", borderRadius: 8,
                                textDecoration: "none",
                                fontSize: "0.85rem",
                                fontWeight: childActive ? 700 : 500,
                                color: childActive ? "#0f172a" : "#475569",
                                background: childActive ? "rgba(10,132,255,0.08)" : "transparent",
                                transition: "background 0.12s",
                              }}
                            >
                              <span style={{ fontSize: 14 }}>{child.icon}</span>
                              {child.label}
                              {childActive && (
                                <span style={{
                                  marginLeft: "auto", width: 6, height: 6, borderRadius: "50%",
                                  background: "#0A84FF", flexShrink: 0,
                                }} />
                              )}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <a key={item.href} href={item.href} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 8,
                  textDecoration: "none", fontSize: "0.82rem",
                  fontWeight: active ? 700 : 500,
                  color: active ? "#0f172a" : "#64748b",
                  background: active ? "rgba(15,23,42,0.07)" : "transparent",
                  transition: "all 0.15s",
                  position: "relative",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  <span style={{ fontSize: 13 }}>{item.icon}</span>
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
          <div style={{ position: "relative", flexShrink: 0, marginLeft: 12 }}>
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

      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 150 }} />
      )}
    </div>
  );
}

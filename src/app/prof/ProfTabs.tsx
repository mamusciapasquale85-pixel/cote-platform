"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  key: "agenda" | "classes" | "evaluations" | "apprentissages" | "import";
  label: string;
  href: string;
};

const TABS: Tab[] = [
  { key: "agenda", label: "Agenda", href: "/agenda" },
  { key: "classes", label: "Classes / Élèves", href: "/teacher" },
  { key: "evaluations", label: "Évaluations", href: "/evaluations" },
  { key: "apprentissages", label: "Apprentissages", href: "/apprentissages" },
  { key: "import", label: "Import", href: "/import" },
];

export default function ProfTabs() {
  const pathname = usePathname();

  const baseTab: React.CSSProperties = {
    minHeight: 44,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.34)",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 18px",
    color: "white",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 700,
    backdropFilter: "blur(2px)",
    transition: "background 120ms ease, border-color 120ms ease, transform 120ms ease",
  };

  const activeTab: React.CSSProperties = {
    fontWeight: 900,
    background: "rgba(255,255,255,0.82)",
    borderColor: "rgba(79,124,255,0.8)",
    color: "#1c3576",
    boxShadow: "0 8px 18px rgba(15,23,42,0.16)",
  };

  const inactiveTab: React.CSSProperties = { opacity: 0.98 };

  return (
    <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
      {TABS.map((t) => {
        const isActive = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.key}
            href={t.href}
            style={{ ...baseTab, ...(isActive ? activeTab : inactiveTab) }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

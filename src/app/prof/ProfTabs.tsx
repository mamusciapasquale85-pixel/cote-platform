"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { key: "classes" | "evaluations" | "agenda" | "apprentissages"; label: string; href: string };

const TABS: Tab[] = [
  { key: "classes", label: "Classes / Élèves", href: "/teacher" },
  { key: "evaluations", label: "Évaluations", href: "/evaluations" },
  { key: "apprentissages", label: "Apprentissages", href: "/apprentissages" },
  { key: "agenda", label: "Agenda", href: "/agenda" },
];

export default function ProfTabs() {
  const pathname = usePathname();

  const baseTab: React.CSSProperties = {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.28)",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    color: "white",
    background: "rgba(255,255,255,0.08)",
  };

  const activeTab: React.CSSProperties = {
    fontWeight: 900,
    background: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.45)",
  };

  const inactiveTab: React.CSSProperties = { opacity: 0.9 };

  return (
    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
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

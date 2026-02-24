"use client";

import React from "react";
import LogoutButton from "../teacher/LogoutButton";
import ProfTabs from "./ProfTabs";

export default function ProfShell(props: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const wrap: React.CSSProperties = { maxWidth: 980, margin: "0 auto", padding: "24px 16px" };

  const header: React.CSSProperties = {
    borderRadius: 18,
    padding: 22,
    background: "linear-gradient(180deg, rgba(45,98,220,0.95), rgba(45,98,220,0.55))",
    color: "white",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  };

  return (
    <div style={wrap}>
      <div style={header}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.15 }}>{props.title ?? "✅ Zone PROF"}</div>
            {props.subtitle ? <div style={{ opacity: 0.9, marginTop: 4 }}>{props.subtitle}</div> : null}
            <ProfTabs />
          </div>
          <LogoutButton />
        </div>
      </div>

      <div style={{ height: 14 }} />
      <div style={{ color: "#171717", opacity: 1 }}>{props.children}</div>
    </div>
  );
}

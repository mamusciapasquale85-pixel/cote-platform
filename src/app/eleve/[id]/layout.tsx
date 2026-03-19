import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exercice | Klasbook",
  description: "Exercice pédagogique",
};

export default function EleveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {children}
    </div>
  );
}

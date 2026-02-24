import ProfShell from "../prof/ProfShell";

export default function EvaluationsLayout({ children }: { children: React.ReactNode }) {
  return <ProfShell title="✅ Zone PROF" subtitle="Gestion des classes, évaluations, agenda">{children}</ProfShell>;
}

import ProfShell from "../prof/ProfShell";

export default function ApprentissagesLayout({ children }: { children: React.ReactNode }) {
  return <ProfShell title="✅ Zone PROF" subtitle="Gestion des classes, évaluations, apprentissages, agenda">{children}</ProfShell>;
}

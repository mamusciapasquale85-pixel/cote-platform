import ProfShell from "../prof/ProfShell";
export default function GenerateurLayout({ children }: { children: React.ReactNode }) {
  return <ProfShell>{children}</ProfShell>;
}

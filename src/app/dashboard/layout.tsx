import ProfShell from "@/app/prof/ProfShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <ProfShell>{children}</ProfShell>;
}

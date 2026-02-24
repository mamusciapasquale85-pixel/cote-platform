import ProfShell from "./ProfShell";

export default function ProfHomePage() {
  const card: React.CSSProperties = {
    borderRadius: 18,
    padding: 16,
    background: "white",
    border: "1px solid rgba(0,0,0,0.10)",
  };

  return (
    <ProfShell title="✅ Zone PROF" subtitle="Navigation rapide">
      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Bienvenue 👋</div>
        <div style={{ opacity: 0.9, lineHeight: 1.5 }}>
          Utilise les onglets en haut pour aller vers :
          <ul style={{ marginTop: 8 }}>
            <li><b>Classes / Élèves</b> (notes, élèves, résultats)</li>
            <li><b>Évaluations</b> (créer / modifier / supprimer)</li>
            <li><b>Agenda</b> (programme, devoirs, interros) — on le branche juste après</li>
          </ul>
        </div>
      </div>
    </ProfShell>
  );
}

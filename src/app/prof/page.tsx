import ProfShell from "./ProfShell";

export default function ProfHomePage() {
  return (
    <ProfShell>
      <div style={{ borderRadius: 16, padding: 20, background: "#fff", border: "1px solid #E5E7EB" }}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Bienvenue 👋</div>
        <div style={{ opacity: 0.9, lineHeight: 1.5 }}>
          Utilise les onglets en haut pour naviguer vers :
          <ul style={{ marginTop: 8 }}>
            <li><b>Classes / Élèves</b> — notes, élèves, résultats</li>
            <li><b>Évaluations</b> — créer, modifier, supprimer</li>
            <li><b>Agenda</b> — programme, devoirs, interros</li>
          </ul>
        </div>
      </div>
    </ProfShell>
  );
}

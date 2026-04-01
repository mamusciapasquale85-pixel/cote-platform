"use client";
import { useState } from "react";
import VocalPlayer from "@/components/vocal/VocalPlayer";
import VocalRecorder, { type PronunciationApiResult } from "@/components/vocal/VocalRecorder";
import PronunciationFeedback from "@/components/vocal/PronunciationFeedback";

type Phrase = { id: string; niveau: "A1" | "A2"; fr: string; nl: string; tip?: string };

const THEMES: Record<string, { label: string; icon: string; phrases: Phrase[] }> = {
  presentation: {
    label: "Se présenter", icon: "👋",
    phrases: [
      { id: "pr1", niveau: "A1", fr: "Bonjour !", nl: "Hallo!", tip: "Le 'H' est aspiré en néerlandais." },
      { id: "pr2", niveau: "A1", fr: "Je m'appelle…", nl: "Ik heet…", tip: "'ee' se prononce comme dans 'fée' mais plus long." },
      { id: "pr3", niveau: "A1", fr: "J'ai 14 ans.", nl: "Ik ben veertien jaar.", tip: "'v' se prononce comme un 'f' doux." },
      { id: "pr4", niveau: "A1", fr: "J'habite à Bruxelles.", nl: "Ik woon in Brussel.", tip: "'oo' est une voyelle longue." },
      { id: "pr5", niveau: "A1", fr: "Comment tu t'appelles ?", nl: "Hoe heet jij?", tip: "'jij' : le 'j' se prononce comme 'y'." },
      { id: "pr6", niveau: "A2", fr: "Je suis belge et j'aime le sport.", nl: "Ik ben Belg en ik hou van sport.", tip: "'hou van' = aimer. 'ou' se prononce 'aou'." },
      { id: "pr7", niveau: "A2", fr: "Enchanté de faire ta connaissance.", nl: "Aangenaam kennis te maken.", tip: "'aa' est une voyelle très ouverte et longue." },
      { id: "pr8", niveau: "A2", fr: "Je vais bien, merci !", nl: "Het gaat goed, dank je wel!", tip: "'g' néerlandais = son guttural du fond de la gorge." },
    ],
  },
  famille: {
    label: "La famille", icon: "👨‍👩‍👧",
    phrases: [
      { id: "fa1", niveau: "A1", fr: "Voici ma mère.", nl: "Dit is mijn moeder.", tip: "'oe' dans 'moeder' = 'ou' court." },
      { id: "fa2", niveau: "A1", fr: "J'ai un frère et une sœur.", nl: "Ik heb een broer en een zus.", tip: "'broer' : 'oe' = 'ou'." },
      { id: "fa3", niveau: "A1", fr: "Mon père s'appelle Marc.", nl: "Mijn vader heet Marc.", tip: "'ij' dans 'mijn' se prononce 'aille'." },
      { id: "fa4", niveau: "A1", fr: "Ma grand-mère est gentille.", nl: "Mijn oma is lief.", tip: "'ie' dans 'lief' = 'i' long." },
      { id: "fa5", niveau: "A2", fr: "Nous sommes une famille de quatre.", nl: "We zijn een gezin van vier.", tip: "'gezin' : le 'g' est guttural." },
      { id: "fa6", niveau: "A2", fr: "Mon oncle habite aux Pays-Bas.", nl: "Mijn oom woont in Nederland.", tip: "'oom' = 'om' avec 'o' très long." },
    ],
  },
  classe: {
    label: "La classe", icon: "🏫",
    phrases: [
      { id: "cl1", niveau: "A1", fr: "Ouvrez votre livre.", nl: "Open je boek.", tip: "'oe' dans 'boek' = 'ou' court." },
      { id: "cl2", niveau: "A1", fr: "Je ne comprends pas.", nl: "Ik begrijp het niet.", tip: "'begrijp' : 'ij' = 'aille'." },
      { id: "cl3", niveau: "A1", fr: "Comment dit-on … en néerlandais ?", nl: "Hoe zeg je dat in het Nederlands?", tip: "'zeg' : 'z' comme en français." },
      { id: "cl4", niveau: "A1", fr: "Je peux aller aux toilettes ?", nl: "Mag ik naar het toilet?", tip: "'mag' : 'g' final s'assourdit." },
      { id: "cl5", niveau: "A2", fr: "J'ai fait mes devoirs.", nl: "Ik heb mijn huiswerk gemaakt.", tip: "'ui' dans 'huiswerk' = son unique : lçvres en 'u', langue en 'i'." },
      { id: "cl6", niveau: "A2", fr: "Puis-je poser une question ?", nl: "Mag ik een vraag stellen?", tip: "'stellen' : double 'l', 'e' court." },
    ],
  },
  ville: {
    label: "La ville", icon: "🏙️",
    phrases: [
      { id: "vi1", niveau: "A1", fr: "Où est la gare ?", nl: "Waar is het station?", tip: "'waar' : 'aa' très long." },
      { id: "vi2", niveau: "A1", fr: "Je vais à l'école à vélo.", nl: "Ik ga met de fiets naar school.", tip: "'school' : 'sch' = 's' + 'ch' guttural." },
      { id: "vi3", niveau: "A1", fr: "Il y a une boulangerie ici.", nl: "Er is hier een bakkerij.", tip: "'bakkerij' : 'ij' final = 'aille'." },
      { id: "vi4", niveau: "A2", fr: "Le marché est ouvert le samedi.", nl: "De markt is open op zaterdag.", tip: "'markt' : 'k' et 't' finals bien prononcés." },
      { id: "vi5", niveau: "A2", fr: "Je prends le bus numéro douze.", nl: "Ik neem de bus nummer twaalf.", tip: "'twaalf' : 'aa' long + 'lf' final clairement articulé." },
    ],
  },
  loisirs: {
    label: "Les loisirs", icon: "⚽",
    phrases: [
      { id: "lo1", niveau: "A1", fr: "J'aime jouer au foot.", nl: "Ik speel graag voetbal.", tip: "'voetbal' : 'oe' = 'ou'." },
      { id: "lo2", niveau: "A1", fr: "Je regarde la télé.", nl: "Ik kijk televisie.", tip: "'kijk' : 'ij' = 'aille'." },
      { id: "lo3", niveau: "A1", fr: "J'écoute de la musique.", nl: "Ik luister naar muziek.", tip: "'luister' : 'ui' = son unique." },
      { id: "lo4", niveau: "A2", fr: "Le week-end, je fais du vélo.", nl: "In het weekend fiets ik.", tip: "'fiets' : 'ie' long + 'ts' final." },
      { id: "lo5", niveau: "A2", fr: "Je lis beaucoup de livres.", nl: "Ik lees veel boeken.", tip: "'lees' : 'ee' = 'é' très long." },
    ],
  },
};

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

export default function VocalPage() {
  const [themeKey, setThemeKey] = useState<string>("presentation");
  const [niveauFilter, setNiveauFilter] = useState<"A1" | "A2" | "tous">("tous");
  const [selectedPhrase, setSelectedPhrase] = useState<Phrase>(THEMES.presentation.phrases[0]);
  const [result, setResult] = useState<PronunciationApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const theme = THEMES[themeKey];
  const phrases = niveauFilter === "tous"
    ? theme.phrases
    : theme.phrases.filter((p) => p.niveau === niveauFilter);

  const handleTheme = (key: string) => {
    setThemeKey(key);
    setSelectedPhrase(THEMES[key].phrases[0]);
    setResult(null); setError(null);
  };
  const handleSelect = (p: Phrase) => { setSelectedPhrase(p); setResult(null); setError(null); };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>

      {/* Sous-header */}
      <div style={{ background: "#0f172a", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10, background: GRADIENT,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 22 }}>🎙</span>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Module Vocal — Néerlandais</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Thème : {theme.label} · FWB A1–A2</div>
        </div>
      </div>

      {/* Sélecteur de thème */}
      <div style={{ background: "#1e293b", padding: "10px 24px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(THEMES).map(([key, t]) => (
          <button key={key} onClick={() => handleTheme(key)} style={{
            padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600,
            background: themeKey === key ? GRADIENT : "rgba(255,255,255,0.08)",
            color: themeKey === key ? "#fff" : "#94a3b8",
            transition: "all 0.15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", gap: 20 }}>

        {/* Liste phrases */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {(["tous", "A1", "A2"] as const).map((n) => (
              <button key={n} onClick={() => setNiveauFilter(n)} style={{
                flex: 1, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                background: niveauFilter === n ? "#0A84FF" : "#e2e8f0",
                color: niveauFilter === n ? "#fff" : "#64748b",
              }}>{n}</button>
            ))}
          </div>

          {phrases.map((p) => (
            <div key={p.id} onClick={() => handleSelect(p)} style={{
              padding: "12px 14px", borderRadius: 12, marginBottom: 8, cursor: "pointer",
              background: selectedPhrase.id === p.id ? "#eff6ff" : "#fff",
              border: `2px solid ${selectedPhrase.id === p.id ? "#0A84FF" : "#e2e8f0"}`,
              transition: "all 0.15s",
            }}>
              <div style={{
                display: "inline-block", padding: "2px 7px", borderRadius: 5,
                fontSize: 11, fontWeight: 700, marginBottom: 5,
                background: p.niveau === "A1" ? "#dcfce7" : "#fef3c7",
                color: p.niveau === "A1" ? "#166534" : "#92400e",
              }}>{p.niveau}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{p.nl}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{p.fr}</div>
            </div>
          ))}
        </div>

        {/* Lecteur + enregistreur */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: "20px 22px", marginBottom: 16, color: "#fff" }}>
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{selectedPhrase.nl}</div>
            <div style={{ fontSize: 15, color: "#94a3b8", marginBottom: selectedPhrase.tip ? 10 : 0 }}>
              🇫🇷 {selectedPhrase.fr}
            </div>
            {selectedPhrase.tip && (
              <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#cbd5e1" }}>
                💡 {selectedPhrase.tip}
              </div>
            )}
          </div>

          <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 12, border: "1px solid #e2e8f0" }}>
            <StepLabel n={1} label="Écoute le modèle" />
            <VocalPlayer text={selectedPhrase.nl} langue="nl" />
          </div>

          <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 12, border: "1px solid #e2e8f0" }}>
            <StepLabel n={2} label="Répète et enregistre-toi" />
            <VocalRecorder
              referenceText={selectedPhrase.nl}
              langue="nl"
              theme={themeKey}
              niveau={selectedPhrase.niveau}
              onResult={(r) => { setResult(r); setError(null); }}
              onError={(e) => setError(e)}
            />
            {error && (
              <div style={{ marginTop: 10, padding: "8px 12px", fontSize: 13, color: "#dc2626", background: "#fef2f2", borderRadius: 8 }}>
                ⚠ {error}
              </div>
            )}
          </div>

          {result && <PronunciationFeedback result={result} />}
          {!result && (
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#0369a1", textAlign: "center" }}>
              🎙 Écoute la prononciation, puis enregistre ta voix pour recevoir un feedback instantané.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{
        width: 26, height: 26, borderRadius: "50%",
        background: n === 1 ? "#0A84FF" : "#FF3B30",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800, flexShrink: 0,
      }}>{n}</span>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
    </div>
  );
}

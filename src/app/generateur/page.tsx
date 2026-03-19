"use client";
import { useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string; id: string };
type Skill = "chat" | "analyse" | "grille" | "diff" | "planning" | "tandem";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

const SKILLS: { id: Skill; label: string; emoji: string; color: string; description: string }[] = [
  { id: "chat",     label: "Chat libre",      emoji: "💬", color: "#0A84FF", description: "Questions sur le référentiel FWB" },
  { id: "analyse",  label: "Analyser copie",  emoji: "📝", color: "#FF3B30", description: "Évaluer une production selon FWB" },
  { id: "grille",   label: "Créer grille",    emoji: "📊", color: "#FF9500", description: "Grille critériée conforme FWB" },
  { id: "diff",     label: "Différenciation", emoji: "🎯", color: "#34C759", description: "3 niveaux d'un même exercice" },
  { id: "planning", label: "Planification",   emoji: "📅", color: "#AF52DE", description: "Plan annuel conforme FWB" },
  { id: "tandem",   label: "Tandem Brio",     emoji: "📗", color: "#00C7BE", description: "Lier le manuel aux attendus FWB" },
];

const SUGGESTIONS: Record<Skill, { label: string; prompt: string }[]> = {
  chat: [
    { label: "Attendus 1S néerlandais", prompt: "Quels sont exactement les attendus grammaticaux néerlandais pour la 1re secondaire selon le référentiel FWB ?" },
    { label: "Attendus 2S néerlandais", prompt: "Quels sont les savoirs grammaticaux néerlandais de la 2e secondaire selon le référentiel FWB ?" },
    { label: "Différence A2.2 vs B1.1", prompt: "Quelle est la différence concrète entre le niveau A2.2 (1S) et B1.1 (2S) en termes d'exigences et de tolérance aux erreurs ?" },
    { label: "5 compétences FWB", prompt: "Explique-moi les 5 compétences du référentiel FWB (EOSI, EOEI, CA, CL, EE) avec des exemples concrets pour la 1re secondaire." },
    { label: "Tolérance aux erreurs", prompt: "Quelles erreurs sont tolérées en 1re secondaire selon le référentiel FWB pour les productions orales et écrites ?" },
    { label: "Critères inspection", prompt: "Quels sont les points de vigilance lors d'une visite d'inspection pour un cours de néerlandais en 1re secondaire FWB ?" },
  ],
  analyse: [
    { label: "Production écrite 1S", prompt: "Analyse cette production écrite d'un élève de 1re secondaire (niveau A2.2, compétence EE) :\n\n[Colle la production ici]" },
    { label: "Production orale 1S", prompt: "Voici la retranscription d'une production orale d'élève de 1re secondaire (EOSI, A2.2). Analyse selon le référentiel FWB :\n\n[Colle la retranscription ici]" },
    { label: "Production écrite 2S", prompt: "Analyse cette production écrite d'un élève de 2e secondaire (niveau B1.1, compétence EE) :\n\n[Colle la production ici]" },
    { label: "Réponses compréhension", prompt: "Voici les réponses d'un élève de 1re secondaire à un exercice de compréhension à la lecture. Évalue selon le référentiel FWB :\nTexte : [texte néerlandais]\nRéponses : [réponses élève]" },
  ],
  grille: [
    { label: "Grille EE 1S", prompt: "Crée une grille d'évaluation critériée complète et conforme FWB pour l'expression écrite (EE) en 1re secondaire (niveau A2.2)." },
    { label: "Grille EOSI 1S", prompt: "Crée une grille pour l'expression orale sans interaction (EOSI) en 1re secondaire (niveau A2.2), conforme référentiel FWB." },
    { label: "Grille CA 2S", prompt: "Crée une grille pour la compréhension à l'audition (CA) en 2e secondaire (niveau B1.1), conforme référentiel FWB." },
    { label: "Grille EOEI 2S", prompt: "Crée une grille pour l'expression orale en interaction (EOEI) en 2e secondaire (niveau B1.1), conforme référentiel FWB." },
    { label: "Grille CL 1S", prompt: "Crée une grille pour la compréhension à la lecture (CL) en 1re secondaire (niveau A2.2), avec les critères FWB exacts." },
  ],
  diff: [
    { label: "Différencier texte à trous 1S", prompt: "Crée 3 niveaux de différenciation pour un texte à trous sur les auxiliaires de mode (moeten, kunnen, mogen, willen), 1re secondaire." },
    { label: "Différencier dialogue 1S", prompt: "Crée 3 niveaux de différenciation pour un dialogue à compléter sur le thème des loisirs, 1re secondaire niveau A2.2." },
    { label: "Différencier production écrite 2S", prompt: "Crée 3 niveaux pour une tâche d'expression écrite sur la vie quotidienne, 2e secondaire niveau B1.1." },
    { label: "Différencier compréhension 2S", prompt: "Crée 3 niveaux pour un exercice de compréhension à la lecture sur les relations avec les autres, 2e secondaire." },
  ],
  planning: [
    { label: "Plan annuel 1re secondaire", prompt: "Génère une planification annuelle complète et conforme au référentiel FWB pour la 1re secondaire (néerlandais, niveau A2.2), avec 4 périodes de 9 semaines et 4 heures/semaine." },
    { label: "Plan annuel 2e secondaire", prompt: "Génère une planification annuelle complète et conforme au référentiel FWB pour la 2e secondaire (néerlandais, niveau B1.1), avec 4 périodes et 4 heures/semaine." },
    { label: "Répartition des compétences", prompt: "Comment répartir les 5 compétences (EOSI, EOEI, CA, CL, EE) sur l'année en 1re secondaire pour être conforme au référentiel FWB et assurer un équilibre ?" },
    { label: "Séquence sur les champs thématiques", prompt: "Dans quel ordre aborder les 12 champs thématiques en 1re secondaire selon le référentiel FWB pour assurer la progression spiralaire ?" },
    { label: "Progression grammaticale 1S", prompt: "Quelle progression grammaticale respecter sur l'année en 1re secondaire pour couvrir tous les savoirs FWB de manière cohérente ?" },
  ],
  tandem: [
    { label: "Tandem Brio — Chapitre 1", prompt: "Fais le lien entre le chapitre 1 de Tandem Brio et les attendus du référentiel FWB pour la 1re secondaire. Quels attendus sont couverts et lesquels manquent ?" },
    { label: "Tandem Brio — Unité vocabulaire", prompt: "Dans Tandem Brio, l'unité sur la famille et les présentations — quels champs thématiques FWB couvre-t-elle et quelles compétences sont travaillées ?" },
    { label: "Tandem Brio — Grammaire OTT", prompt: "Le chapitre de Tandem Brio sur l'OTT (présent) — est-il conforme aux attendus FWB de 1re secondaire ? Que faut-il ajouter ou adapter ?" },
    { label: "Tandem Brio — Tâche finale", prompt: "Comment adapter la tâche finale d'une unité de Tandem Brio pour la rendre conforme aux attendus FWB (compétence EE ou EOSI) en 1re secondaire ?" },
    { label: "Manque Tandem Brio vs FWB", prompt: "Quels points du référentiel FWB néerlandais 1re secondaire ne sont PAS couverts par Tandem Brio et nécessitent des activités supplémentaires ?" },
  ],
};

const PLACEHOLDERS: Record<Skill, string> = {
  chat: "Question sur le référentiel FWB, les attendus, les niveaux CECRL…",
  analyse: "Colle la production de l'élève (précise la classe 1S/2S et la compétence)…",
  grille: "Précise la compétence (EOSI/EOEI/CA/CL/EE), la classe (1S/2S) et le champ thématique…",
  diff: "Décris l'exercice à différencier (type, thème, classe)…",
  planning: "Précise la classe (1S/2S), le nombre d'heures/semaine, et toute contrainte spécifique…",
  tandem: "Mentionne un chapitre, une unité ou un point de grammaire de Tandem Brio…",
};

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ fontSize: 14, lineHeight: 1.85, color: "#1e293b" }}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 8 }} />;
        if (/^### /.test(t)) return <div key={i} style={{ fontWeight: 900, fontSize: 12, color: "#0A84FF", marginTop: 16, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>{t.replace(/^### /, "")}</div>;
        if (/^## /.test(t)) return <div key={i} style={{ fontWeight: 900, fontSize: 15, color: "#FF3B30", marginTop: 20, marginBottom: 6 }}>{t.replace(/^## /, "")}</div>;
        if (/^# /.test(t)) return <div key={i} style={{ fontWeight: 900, fontSize: 17, color: "#0F172A", marginTop: 22, marginBottom: 8 }}>{t.replace(/^# /, "")}</div>;
        if (/^---+$/.test(t)) return <hr key={i} style={{ border: "none", borderTop: "2px solid #f1f5f9", margin: "14px 0" }} />;
        if (/^(✅|🟢)/.test(t)) return <div key={i} style={{ padding: "4px 10px", background: "rgba(34,197,94,0.08)", borderLeft: "3px solid #22c55e", borderRadius: "0 8px 8px 0", marginBottom: 4, color: "#166534", fontWeight: 600 }}>{t}</div>;
        if (/^(❌|🔴)/.test(t)) return <div key={i} style={{ padding: "4px 10px", background: "rgba(220,38,38,0.08)", borderLeft: "3px solid #ef4444", borderRadius: "0 8px 8px 0", marginBottom: 4, color: "#991b1b", fontWeight: 600 }}>{t}</div>;
        if (/^(⚠️|🟡)/.test(t)) return <div key={i} style={{ padding: "4px 10px", background: "rgba(234,179,8,0.08)", borderLeft: "3px solid #eab308", borderRadius: "0 8px 8px 0", marginBottom: 4, color: "#854d0e", fontWeight: 600 }}>{t}</div>;
        if (/^\*\*(.+)\*\*$/.test(t)) return <div key={i} style={{ fontWeight: 800, color: "#0F172A", marginTop: 8, marginBottom: 2 }}>{t.replace(/\*\*/g, "")}</div>;
        if (/^\|/.test(t)) {
          if (/^\|[-| ]+\|$/.test(t)) return null;
          const cells = t.split("|").slice(1, -1).map(c => c.trim());
          const isHeader = lines[i + 1]?.trim().startsWith("|---");
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: 1, marginBottom: 1 }}>
              {cells.map((cell, j) => (
                <div key={j} style={{ padding: "5px 8px", background: isHeader ? "#f1f5f9" : j === 0 ? "rgba(10,132,255,0.04)" : "#fff", border: "1px solid #e2e8f0", fontSize: 12, fontWeight: isHeader ? 700 : 400 }}>{cell}</div>
              ))}
            </div>
          );
        }
        if (/^[-•]\s/.test(t)) return <div key={i} style={{ padding: "2px 0 2px 16px", borderLeft: "3px solid #e2e8f0", marginBottom: 2, color: "#374151" }}>{t.slice(2)}</div>;
        if (/^\d+\.\s/.test(t)) return <div key={i} style={{ padding: "3px 0 3px 20px", marginBottom: 3, color: "#334155" }}>{t}</div>;
        const bold = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:12px">$1</code>');
        return <div key={i} dangerouslySetInnerHTML={{ __html: bold }} style={{ marginBottom: 2 }} />;
      })}
    </div>
  );
}

export default function InspecteurFWBPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<Skill>("chat");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return;
    const userMsg: Message = { role: "user", content: content.trim(), id: Date.now().toString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);
    setError(null);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch("/api/inspecteur-fwb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      const assistantMsg: Message = { role: "assistant", content: data.message ?? "", id: (Date.now() + 1).toString() };
      setMessages([...newMessages, assistantMsg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); }
  }

  const currentSkill = SKILLS.find(s => s.id === activeSkill)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", maxHeight: 920, gap: 0 }}>

      {/* HEADER */}
      <div style={{ borderRadius: 18, padding: "14px 20px", background: GRADIENT, color: "#fff", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>🏛️ Inspecteur FWB</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 1 }}>Référentiel Langues Modernes · Néerlandais 1S & 2S · Tandem Brio · Claude Sonnet</div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); setError(null); setInput(""); }} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 10, padding: "5px 12px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
            Nouvelle conversation
          </button>
        )}
      </div>

      {/* SKILLS TABS — 2 rangées sur mobile */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 10 }}>
        {SKILLS.map(skill => (
          <button key={skill.id} onClick={() => setActiveSkill(skill.id)} style={{
            padding: "8px 4px", borderRadius: 12,
            border: activeSkill === skill.id ? `2px solid ${skill.color}` : "1.5px solid #e2e8f0",
            background: activeSkill === skill.id ? `${skill.color}18` : "#fff",
            color: activeSkill === skill.id ? skill.color : "#64748b",
            fontWeight: activeSkill === skill.id ? 800 : 600, fontSize: 11,
            cursor: "pointer", transition: "all 0.15s", textAlign: "center",
          }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{skill.emoji}</div>
            <div style={{ lineHeight: 1.2 }}>{skill.label}</div>
          </button>
        ))}
      </div>

      {/* SUGGESTIONS */}
      {messages.length === 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
            {currentSkill.emoji} {currentSkill.description.toUpperCase()}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUGGESTIONS[activeSkill].map((s, i) => (
              <button key={i} onClick={() => setInput(s.prompt)} style={{
                padding: "7px 12px", borderRadius: 99,
                border: `1.5px solid ${currentSkill.color}40`,
                background: `${currentSkill.color}0a`,
                color: currentSkill.color,
                fontWeight: 600, fontSize: 12, cursor: "pointer",
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MESSAGES */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 2 }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "28px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>{currentSkill.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#475569" }}>{currentSkill.label}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{currentSkill.description}</div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "88%",
              borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "11px 15px",
              background: msg.role === "user" ? GRADIENT : "#fff",
              color: msg.role === "user" ? "#fff" : "#1e293b",
              border: msg.role === "assistant" ? "1px solid rgba(15,23,42,0.08)" : "none",
              boxShadow: "0 2px 8px rgba(15,23,42,0.07)",
            }}>
              {msg.role === "assistant" ? <MarkdownText text={msg.content} /> : (
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14 }}>{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", boxShadow: "0 2px 8px rgba(15,23,42,0.07)" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#94a3b8", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>L'Inspecteur FWB analyse le référentiel…</span>
              </div>
            </div>
          </div>
        )}
        {error && <div style={{ borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", padding: "10px 14px", fontSize: 13 }}>⚠️ {error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div style={{ marginTop: 10, background: "#fff", borderRadius: 16, border: `1.5px solid ${currentSkill.color}40`, padding: "10px 14px", boxShadow: "0 4px 12px rgba(15,23,42,0.06)" }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDERS[activeSkill]}
          rows={2}
          style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 14, lineHeight: 1.6, color: "#1e293b", background: "transparent", fontFamily: "system-ui, sans-serif", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Entrée pour envoyer · Maj+Entrée pour saut de ligne</span>
          <button
            onClick={() => void sendMessage(input)} disabled={!input.trim() || loading}
            style={{ padding: "7px 16px", borderRadius: 10, border: "none", background: !input.trim() || loading ? "#e2e8f0" : GRADIENT, color: !input.trim() || loading ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: 13, cursor: !input.trim() || loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "⏳" : "Envoyer →"}
          </button>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:.5} 50%{transform:scale(1.3);opacity:1} }`}</style>
    </div>
  );
}

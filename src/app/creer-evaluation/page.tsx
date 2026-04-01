"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Subject = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  types: { id: string; label: string }[];
  niveaux: string[];
};

type SchoolTemplate = {
  school_name: string;
  teacher_name: string;
  subject_display: string;
  address: string;
  logo_url: string;
};

type GenResult = {
  exercice: string;
  titre: string;
  id: string | null;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";


const COMPETENCES_FWB = [
  { id: "audition", label: "Compréhension à l'audition" },
  { id: "lecture", label: "Compréhension à la lecture" },
  { id: "expression_ecrite", label: "Expression écrite" },
  { id: "orale_sans", label: "Expression orale (sans interaction)" },
  { id: "orale_avec", label: "Expression orale (avec interaction)" },
];

const DEFAULT_TEMPLATE: SchoolTemplate = {
  school_name: "",
  teacher_name: "",
  subject_display: "",
  address: "",
  logo_url: "",
};

const SUBJECTS: Subject[] = [
  {
    id: "nl",
    label: "Néerlandais",
    emoji: "🇳🇱",
    color: "#FF9500",
    niveaux: ["A1", "A2", "B1", "B2"],
    types: [
      { id: "lacunes", label: "Texte à trous" },
      { id: "qcm", label: "QCM" },
      { id: "conjugaison", label: "Conjugaison" },
      { id: "dialogue", label: "Dialogue à compléter" },
      { id: "traduction", label: "Traduction" },
      { id: "vocabulaire_images", label: "Vocabulaire" },
      { id: "associer", label: "Association" },
      { id: "lecture", label: "Compréhension écrite" },
      { id: "remise_ordre", label: "Remise en ordre" },
      { id: "flashcards", label: "Flashcards" },
      { id: "mots_meles", label: "Mots mêlés" },
      { id: "kahoot_csv", label: "Questions Kahoot" },
      { id: "comp_ee", label: "Expression Écrite (EE)" },
      { id: "comp_ca", label: "Compréhension à l'Audition (CA)" },
      { id: "comp_eosi", label: "Expr. Orale sans Interaction (EOSI)" },
      { id: "comp_eoi", label: "Expr. Orale avec Interactions (EOI)" },
      { id: "comp_cl", label: "Compréhension à la Lecture (CL)" },
    ],
  },
  {
    id: "francais",
    label: "Français",
    emoji: "📖",
    color: "#AF52DE",
    niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"],
    types: [
      { id: "lecture_fr", label: "Compréhension à la lecture" },
      { id: "expression_ecrite", label: "Expression écrite" },
      { id: "grammaire_fr", label: "Grammaire française" },
      { id: "orthographe", label: "Orthographe / Dictée" },
      { id: "analyse_texte", label: "Analyse de texte littéraire" },
    ],
  },
  {
    id: "mathematiques",
    label: "Mathématiques",
    emoji: "📐",
    color: "#0A84FF",
    niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"],
    types: [
      { id: "calcul", label: "Exercices de calcul" },
      { id: "probleme", label: "Résolution de problèmes" },
      { id: "geometrie", label: "Géométrie" },
      { id: "algebre", label: "Algèbre / Équations" },
      { id: "statistiques", label: "Statistiques" },
    ],
  },
  {
    id: "sciences",
    label: "Sciences",
    emoji: "🔬",
    color: "#34C759",
    niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"],
    types: [
      { id: "qcm_sc", label: "QCM Sciences" },
      { id: "observation", label: "Observation / Expérience" },
      { id: "schemas_sc", label: "Schémas légendés" },
      { id: "protocole", label: "Protocole expérimental" },
    ],
  },
  {
    id: "histoire",
    label: "Histoire",
    emoji: "🏛️",
    color: "#FF3B30",
    niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"],
    types: [
      { id: "analyse_source", label: "Analyse de source" },
      { id: "chronologie", label: "Chronologie" },
      { id: "qcm_hist", label: "QCM Histoire" },
      { id: "synthese_hist", label: "Synthèse historique" },
    ],
  },
  {
    id: "geographie",
    label: "Géographie",
    emoji: "🗺️",
    color: "#00C7BE",
    niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"],
    types: [
      { id: "analyse_carte", label: "Analyse de carte" },
      { id: "paysage", label: "Analyse de paysage / photo" },
      { id: "qcm_geo", label: "QCM Géographie" },
      { id: "croquis", label: "Croquis / Schéma géo" },
    ],
  },
  {
    id: "en",
    label: "Anglais",
    emoji: "🇬🇧",
    color: "#5856D6",
    niveaux: ["A1", "A2", "B1", "B2"],
    types: [
      { id: "lacunes", label: "Texte à trous" },
      { id: "qcm", label: "QCM" },
      { id: "conjugaison", label: "Conjugaison" },
      { id: "dialogue", label: "Dialogue à compléter" },
      { id: "traduction", label: "Traduction" },
      { id: "lecture", label: "Compréhension écrite" },
      { id: "flashcards", label: "Flashcards" },
      { id: "comp_ee", label: "Expression Écrite (EE)" },
      { id: "comp_ca", label: "Compréhension à l'Audition (CA)" },
      { id: "comp_eosi", label: "Expr. Orale sans Interaction (EOSI)" },
      { id: "comp_eoi", label: "Expr. Orale avec Interactions (EOI)" },
      { id: "comp_cl", label: "Compréhension à la Lecture (CL)" },
    ],
  },
];

// ─── Composant principal ───────────────────────────────────────────────────────

export default function CreerEvaluationPage() {
  const supabase = createClient();

  // Template école (persisté dans user_profiles.template_json)
  const [template, setTemplate] = useState<SchoolTemplate>(DEFAULT_TEMPLATE);
  const [templateSaved, setTemplateSaved] = useState(false);

  // Paramètres de génération
  const [selectedSubject, setSelectedSubject] = useState<Subject>(SUBJECTS[0]);
  const [typeExercice, setTypeExercice] = useState(SUBJECTS[0].types[0].id);
  const [niveau, setNiveau] = useState(SUBJECTS[0].niveaux[0]);
  const [theme, setTheme] = useState("");
  const [classe, setClasse] = useState("");
  const [maxPoints, setMaxPoints] = useState("20");
  const [evalDate, setEvalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [competenceFWB, setCompetenceFWB] = useState(COMPETENCES_FWB[0].id);

  // Résultat
  const [result, setResult] = useState<GenResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load template depuis Supabase
  useEffect(() => {
    async function loadTemplate() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("template_json, full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        const saved = (data.template_json ?? {}) as Partial<SchoolTemplate>;
        setTemplate({
          school_name: saved.school_name ?? "",
          teacher_name: saved.teacher_name ?? (data.full_name ?? ""),
          subject_display: saved.subject_display ?? "",
          address: saved.address ?? "",
          logo_url: saved.logo_url ?? "",
        });
      }
    }
    void loadTemplate();
  }, [supabase]);

  // Sauvegarde du template
  async function saveTemplate() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("user_profiles")
      .update({ template_json: template })
      .eq("id", user.id);
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2000);
  }

  // Changement de matière → reset type + niveau
  function handleSubjectChange(subj: Subject) {
    setSelectedSubject(subj);
    setTypeExercice(subj.types[0].id);
    setNiveau(subj.niveaux[0]);
  }

  // Génération via API
  async function handleGenerate() {
    if (!theme.trim()) {
      setError("Saisis un thème avant de générer.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generer-exercice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: selectedSubject.id,
          langue: selectedSubject.id,
          type_exercice: typeExercice,
          competence_fwb: competenceFWB,
          niveau,
          theme,
          classe,
        }),
      });
      const data = (await res.json()) as { exercice?: string; titre?: string; id?: string | null; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Erreur serveur");
      setResult({ exercice: data.exercice ?? "", titre: data.titre ?? theme, id: data.id ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  // Génération PDF avec jspdf côté client
  async function handleDownloadPDF() {
    if (!result) return;

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const PAGE_W = 210;
    const PAGE_H = 297;
    const ML = 15; // margin left
    const MR = 15; // margin right
    const MT = 15; // margin top
    const CONTENT_W = PAGE_W - ML - MR; // 180mm

    let y = MT;

    // ── Barre de couleur en haut ──────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, PAGE_W, 10, "F");
    doc.setFillColor(10, 132, 255);
    doc.rect(0, 0, 70, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("KLASBOOK", 4, 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(200, 220, 255);
    doc.text("Plateforme pédagogique FWB", 4, 14);

    y = 20;

    // ── Nom de l'école ───────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    const schoolName = template.school_name || "École";
    doc.text(schoolName.toUpperCase(), ML, y);
    y += 5;

    if (template.address) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(template.address, ML, y);
      y += 4;
    }

    y += 2;

    // ── Ligne séparatrice ─────────────────────────────────────
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(ML, y, PAGE_W - MR, y);
    y += 5;

    // ── Grille d'infos (2 colonnes) ───────────────────────────
    const COL2 = ML + CONTENT_W / 2;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);

    const infoRows: [string, string, string, string][] = [
      ["Professeur :", template.teacher_name || "—", "Matière :", selectedSubject.label],
      ["Classe :", classe || "—", "Date :", formatDateFR(evalDate)],
      ["Nom / Prénom :", "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _", "Points :", `       / ${maxPoints}`],
    ];

    for (const [label1, val1, label2, val2] of infoRows) {
      doc.setFont("helvetica", "bold");
      doc.text(label1, ML, y);
      doc.setFont("helvetica", "normal");
      doc.text(val1, ML + 28, y);
      doc.setFont("helvetica", "bold");
      doc.text(label2, COL2, y);
      doc.setFont("helvetica", "normal");
      doc.text(val2, COL2 + 22, y);
      y += 6;
    }

    y += 2;

    // ── Titre de l'évaluation ─────────────────────────────────
    doc.setFillColor(248, 250, 252);
    doc.rect(ML, y - 4, CONTENT_W, 10, "F");
    doc.setDrawColor(10, 132, 255);
    doc.setLineWidth(0.5);
    doc.line(ML, y - 4, ML, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(10, 132, 255);
    const titleLabel = SUBJECTS.find(s => s.id === selectedSubject.id)?.types.find(t => t.id === typeExercice)?.label ?? "Évaluation";
    doc.text(`${titleLabel.toUpperCase()} — ${theme}`, ML + 4, y + 2);
    y += 14;

    // ── Ligne séparatrice ─────────────────────────────────────
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(ML, y - 4, PAGE_W - MR, y - 4);

    // ── Contenu généré (texte enrichi) ────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);

    const lines = result.exercice.split("\n");

    for (const rawLine of lines) {
      // Pagination
      if (y > PAGE_H - 20) {
        addFooter(doc, PAGE_W, PAGE_H, ML, MR, template.school_name);
        doc.addPage();
        // Barre en haut
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, PAGE_W, 8, "F");
        doc.setFillColor(10, 132, 255);
        doc.rect(0, 0, 60, 8, "F");
        y = 18;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
      }

      const line = rawLine.trimEnd();

      // Titres niveau 1 : lignes commençant par lettres majuscules + "—" ou ":" ou tout en majuscules
      if (/^#{1,3}\s/.test(line)) {
        const text = line.replace(/^#{1,3}\s/, "").trim();
        y += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(10, 132, 255);
        doc.text(text, ML, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        continue;
      }

      // Lignes de type "TYPE :" ou "PARTIE" ou "CORRIGÉ" (tout en majuscules)
      if (/^[A-ZÉÈÀÙÊÎÔÛÇ\s\d–—:]{5,}$/.test(line.trim()) && line.trim().length > 4) {
        y += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(255, 59, 48); // rouge
        doc.text(line.trim(), ML, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        continue;
      }

      // Ligne vide
      if (!line.trim()) {
        y += 4;
        continue;
      }

      // Ligne de séparation "---"
      if (/^-{3,}$/.test(line.trim())) {
        doc.setDrawColor(226, 232, 240);
        doc.line(ML, y, PAGE_W - MR, y);
        y += 4;
        continue;
      }

      // Ligne normale avec word-wrap
      const wrapped = doc.splitTextToSize(line, CONTENT_W);
      for (const wLine of wrapped as string[]) {
        if (y > PAGE_H - 20) {
          addFooter(doc, PAGE_W, PAGE_H, ML, MR, template.school_name);
          doc.addPage();
          doc.setFillColor(15, 23, 42);
          doc.rect(0, 0, PAGE_W, 8, "F");
          doc.setFillColor(10, 132, 255);
          doc.rect(0, 0, 60, 8, "F");
          y = 18;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59);
        }
        doc.text(wLine, ML, y);
        y += 5.5;
      }
    }

    // Footer dernière page
    addFooter(doc, PAGE_W, PAGE_H, ML, MR, template.school_name);

    // Téléchargement
    const filename = `${sanitize(result.titre || "evaluation")}.pdf`;
    doc.save(filename);
  }

  const subject = selectedSubject;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── En-tête ── */}
      <div style={{
        borderRadius: 18, padding: "14px 20px",
        background: GRADIENT, color: "#fff",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>
            📄 Créer une évaluation
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 1 }}>
            Canevas école · Génération IA · Toutes matières · Téléchargement PDF
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.8, textAlign: "right" }}>
          {subject.emoji} {subject.label}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>

        {/* ── Colonne gauche : config ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Canevas école */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
              🏫 Canevas école
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <TemplateField
                label="Nom de l'école"
                value={template.school_name}
                placeholder="Institut Marie Curie"
                onChange={v => setTemplate(t => ({ ...t, school_name: v }))}
              />
              <TemplateField
                label="Nom du professeur"
                value={template.teacher_name}
                placeholder="Pasquale Mamuscia"
                onChange={v => setTemplate(t => ({ ...t, teacher_name: v }))}
              />
              <TemplateField
                label="Adresse / ville"
                value={template.address}
                placeholder="Rue de l'École 1, Bruxelles"
                onChange={v => setTemplate(t => ({ ...t, address: v }))}
              />
            </div>
            <button
              onClick={() => void saveTemplate()}
              style={{
                marginTop: 10, width: "100%", padding: "7px 0", borderRadius: 8,
                border: "none", background: templateSaved ? "#34C759" : "#0f172a",
                color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              {templateSaved ? "✓ Sauvegardé !" : "Sauvegarder le canevas"}
            </button>
          </div>

          {/* Infos de l'évaluation */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
              📋 Évaluation
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <TemplateField
                label="Classe"
                value={classe}
                placeholder="3GTM"
                onChange={setClasse}
              />
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
                Date
                <input
                  type="date"
                  value={evalDate}
                  onChange={e => setEvalDate(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 3, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box" }}
                />
              </label>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
                Points maximum
                <input
                  type="number"
                  value={maxPoints}
                  min={1}
                  max={100}
                  onChange={e => setMaxPoints(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 3, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box" }}
                />
              </label>
            </div>
          </div>

          {/* Matière */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
              📚 Matière
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {SUBJECTS.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSubjectChange(s)}
                  style={{
                    padding: "8px 6px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                    border: selectedSubject.id === s.id ? `2px solid ${s.color}` : "1.5px solid #e2e8f0",
                    background: selectedSubject.id === s.id ? `${s.color}18` : "#fff",
                    color: selectedSubject.id === s.id ? s.color : "#64748b",
                    cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                  }}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Paramètres IA */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
              ✨ Paramètres IA
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
                Compétence FWB
                <select
                  value={competenceFWB}
                  onChange={e => setCompetenceFWB(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 3, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, background: "#fff" }}
                >
                  {COMPETENCES_FWB.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
                Type d&apos;exercice
                <select
                  value={typeExercice}
                  onChange={e => setTypeExercice(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 3, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, background: "#fff" }}
                >
                  {subject.types.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
                Niveau
                <select
                  value={niveau}
                  onChange={e => setNiveau(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 3, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, background: "#fff" }}
                >
                  {subject.niveaux.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
                Thème / sujet *
                <input
                  type="text"
                  value={theme}
                  onChange={e => setTheme(e.target.value)}
                  placeholder="Ex: Les auxiliaires de mode, La Révolution française…"
                  style={{ display: "block", width: "100%", marginTop: 3, padding: "6px 8px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box" }}
                />
              </label>
            </div>

            <button
              onClick={() => void handleGenerate()}
              disabled={loading || !theme.trim()}
              style={{
                marginTop: 12, width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
                background: loading || !theme.trim() ? "#e2e8f0" : GRADIENT,
                color: loading || !theme.trim() ? "#94a3b8" : "#fff",
                fontWeight: 800, fontSize: 13, cursor: loading || !theme.trim() ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {loading ? "⏳ Génération en cours…" : `✨ Générer avec Claude`}
            </button>
            {error && (
              <div style={{ marginTop: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#991b1b" }}>
                ⚠️ {error}
              </div>
            )}
          </div>
        </div>

        {/* ── Colonne droite : aperçu ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Aperçu du canevas */}
          <div style={{
            background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0",
            overflow: "hidden",
          }}>
            {/* Barre noire + bleue comme dans le PDF */}
            <div style={{ display: "flex", height: 8 }}>
              <div style={{ width: 80, background: "#0A84FF" }} />
              <div style={{ flex: 1, background: "#0f172a" }} />
            </div>
            <div style={{ padding: "14px 18px" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", letterSpacing: "0.02em" }}>
                {template.school_name ? template.school_name.toUpperCase() : <span style={{ color: "#94a3b8" }}>NOM DE L&apos;ÉCOLE</span>}
              </div>
              {template.address && (
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{template.address}</div>
              )}
              <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 10, paddingTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 0", fontSize: 12 }}>
                <PreviewRow label="Professeur" value={template.teacher_name} />
                <PreviewRow label="Matière" value={selectedSubject.label} />
                <PreviewRow label="Classe" value={classe} />
                <PreviewRow label="Date" value={formatDateFR(evalDate)} />
                <PreviewRow label="Nom / Prénom" value="_ _ _ _ _ _ _ _ _ _ _" />
                <PreviewRow label="Points" value={`       / ${maxPoints}`} />
              </div>
              <div style={{
                marginTop: 12, padding: "7px 10px", background: "#f8fafc",
                borderLeft: "3px solid #0A84FF", borderRadius: "0 8px 8px 0",
                fontSize: 11, fontWeight: 700, color: "#0A84FF",
              }}>
                {SUBJECTS.find(s => s.id === selectedSubject.id)?.types.find(t => t.id === typeExercice)?.label?.toUpperCase() ?? "ÉVALUATION"} — {theme || "Thème à définir"}
              </div>
            </div>
          </div>

          {/* Contenu généré */}
          {loading && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>Claude génère l&apos;exercice…</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                {selectedSubject.emoji} {selectedSubject.label} · {niveau} · {theme}
              </div>
            </div>
          )}

          {result && !loading && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid #e2e8f0",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>✅ {result.titre}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                    {selectedSubject.emoji} {selectedSubject.label} · Niveau {niveau}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {result.id && (
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/eleve/${result.id}`;
                        void navigator.clipboard.writeText(url);
                        alert(`Lien copié !\n${url}`);
                      }}
                      style={{
                        padding: "8px 14px", borderRadius: 10, border: "1.5px solid #0A84FF",
                        background: "#fff", color: "#0A84FF",
                        fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}
                    >
                      🔗 Lien élève
                    </button>
                  )}
                  <button
                    onClick={() => void handleDownloadPDF()}
                    style={{
                      padding: "8px 16px", borderRadius: 10, border: "none",
                      background: GRADIENT, color: "#fff",
                      fontWeight: 800, fontSize: 12, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    ⬇️ Télécharger PDF
                  </button>
                </div>
              </div>
              <ExercicePreview text={result.exercice} />
            </div>
          )}

          {!result && !loading && (
            <div style={{
              background: "#fff", borderRadius: 14, border: "1.5px dashed #e2e8f0",
              padding: 40, textAlign: "center", color: "#94a3b8",
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#64748b" }}>
                Configure les paramètres et clique sur &quot;Générer avec Claude&quot;
              </div>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                L&apos;exercice apparaîtra ici — prêt à télécharger en PDF avec ton canevas école
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function TemplateField({
  label, value, placeholder, onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          display: "block", width: "100%", marginTop: 3,
          padding: "6px 8px", border: "1px solid #e2e8f0",
          borderRadius: 6, fontSize: 12, boxSizing: "border-box",
          fontFamily: "system-ui, sans-serif",
        }}
      />
    </label>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontWeight: 700, color: "#64748b" }}>{label} : </span>
      <span style={{ color: value ? "#0f172a" : "#94a3b8" }}>{value || "—"}</span>
    </div>
  );
}

function ExercicePreview({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ padding: "14px 16px", maxHeight: 480, overflowY: "auto", fontSize: 13, lineHeight: 1.8, color: "#1e293b" }}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 6 }} />;
        if (/^#{1,3}\s/.test(t)) {
          return <div key={i} style={{ fontWeight: 900, color: "#0A84FF", marginTop: 12, marginBottom: 4, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.replace(/^#{1,3}\s/, "")}</div>;
        }
        if (/^[A-ZÉÈÀÙÊÎÔÛÇ\s\d–—:]{5,}$/.test(t) && t.length > 4) {
          return <div key={i} style={{ fontWeight: 800, color: "#FF3B30", marginTop: 10, marginBottom: 3 }}>{t}</div>;
        }
        if (/^-{3,}$/.test(t)) {
          return <hr key={i} style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "8px 0" }} />;
        }
        if (/^[-•]\s/.test(t)) {
          return <div key={i} style={{ paddingLeft: 14, borderLeft: "2px solid #e2e8f0", marginBottom: 2 }}>{t.slice(2)}</div>;
        }
        if (/^\d+\.\s/.test(t)) {
          return <div key={i} style={{ paddingLeft: 18, marginBottom: 3 }}>{t}</div>;
        }
        const bold = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        return <div key={i} dangerouslySetInnerHTML={{ __html: bold }} style={{ marginBottom: 1 }} />;
      })}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function sanitize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9-_\s]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}

function addFooter(
  doc: import("jspdf").jsPDF,
  pageW: number,
  pageH: number,
  ml: number,
  mr: number,
  schoolName: string,
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const footerText = `Klasbook${schoolName ? ` · ${schoolName}` : ""} · Généré le ${new Date().toLocaleDateString("fr-BE")}`;
  doc.text(footerText, ml, pageH - 8);
  doc.setDrawColor(226, 232, 240);
  doc.line(ml, pageH - 12, pageW - mr, pageH - 12);
}

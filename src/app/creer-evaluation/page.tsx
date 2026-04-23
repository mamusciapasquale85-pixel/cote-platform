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
    label: "Sciences / Chimie / Physique",
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

  // Compétences FWB uniquement pour les langues modernes
  const isLangueSubject = ["nl", "en", "francais"].includes(selectedSubject.id);

  // Résultat
  const [result, setResult] = useState<GenResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load template depuis Supabase + pré-sélection matière de l'onboarding
  useEffect(() => {
    async function loadTemplate() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data }, { data: coursesData }] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("template_json, full_name")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("courses")
          .select("subject_area")
          .order("created_at", { ascending: true })
          .limit(5),
      ]);

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

      // Pré-sélectionner la matière principale de l'enseignant
      if (coursesData && coursesData.length > 0) {
        const primaryArea = (coursesData[0] as { subject_area: string }).subject_area;
        const match = SUBJECTS.find(s => s.id === primaryArea);
        if (match) handleSubjectChange(match);
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
          langue: isLangueSubject ? selectedSubject.id : undefined,
          type_exercice: typeExercice,
          ...(isLangueSubject ? { competence_fwb: competenceFWB } : {}),
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

    // ── Contenu généré (rendu propre) ────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);

    const rawLines = result.exercice.split("\n");

    // Helper: nouvelle page avec barre
    function newPage() {
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

    // Helper: écrire du texte wrappé
    function writeWrapped(text: string, indent: number = 0, lineH: number = 5.5) {
      const wrapped = doc.splitTextToSize(text, CONTENT_W - indent) as string[];
      for (const wLine of wrapped) {
        if (y > PAGE_H - 20) newPage();
        doc.text(wLine, ML + indent, y);
        y += lineH;
      }
    }

    // Regrouper les lignes de table consécutives
    let i = 0;
    while (i < rawLines.length) {
      if (y > PAGE_H - 20) newPage();

      const rawLine = rawLines[i].trimEnd();
      const line = rawLine;

      // ── Ligne vide ──
      if (!line.trim()) {
        y += 3;
        i++;
        continue;
      }

      // ── Séparateur --- ──
      if (/^-{3,}$/.test(line.trim())) {
        doc.setDrawColor(210, 218, 228);
        doc.setLineWidth(0.3);
        doc.line(ML, y, PAGE_W - MR, y);
        y += 4;
        i++;
        continue;
      }

      // ── Titre Markdown ### ## # ──
      if (/^#{1,3}\s/.test(line)) {
        const level = (line.match(/^(#{1,3})/) ?? ["#"])[0].length;
        const text = processPdfText(line.replace(/^#{1,3}\s+/, ""));
        y += 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(level === 1 ? 12 : level === 2 ? 11 : 10.5);
        doc.setTextColor(10, 132, 255);
        writeWrapped(text);
        y += 1;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        i++;
        continue;
      }

      // ── Ligne tout en MAJUSCULES (section CORRIGÉ, PARTIE, SÉRIE…) ──
      if (/^[A-ZÉÈÀÙÊÎÔÛÇ\s\d–—:]{5,}$/.test(line.trim()) && line.trim().length > 4) {
        y += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(220, 38, 38);
        doc.text(processPdfText(line.trim()), ML, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        i++;
        continue;
      }

      // ── Ligne de citation/encadré > ... ──
      if (/^\s*>/.test(line)) {
        const text = processPdfText(line.replace(/^\s*>\s?/, ""));
        doc.setFillColor(241, 245, 249);
        doc.rect(ML, y - 3.5, CONTENT_W, 7, "F");
        doc.setDrawColor(10, 132, 255);
        doc.setLineWidth(0.8);
        doc.line(ML, y - 3.5, ML, y + 3.5);
        doc.setLineWidth(0.3);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        writeWrapped(text, 4, 5);
        y += 2;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        i++;
        continue;
      }

      // ── Tableau Markdown | col | col | ──
      if (/^\|/.test(line.trim())) {
        // Collecter toutes les lignes du tableau
        const tableLines: string[] = [];
        let j = i;
        while (j < rawLines.length && /^\|/.test(rawLines[j].trim())) {
          if (!isTableSeparator(rawLines[j])) {
            tableLines.push(rawLines[j]);
          }
          j++;
        }
        i = j;

        if (tableLines.length === 0) continue;

        // Calculer largeurs de colonnes
        const rows = tableLines.map(parseTableRow);
        const maxCols = Math.max(...rows.map(r => r.length));
        const colW = CONTENT_W / maxCols;

        y += 2;
        for (let ri = 0; ri < rows.length; ri++) {
          if (y > PAGE_H - 20) newPage();
          const isHeader = ri === 0;

          // Fond alternée
          if (isHeader) {
            doc.setFillColor(226, 232, 240);
            doc.rect(ML, y - 4, CONTENT_W, 6.5, "F");
          } else if (ri % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(ML, y - 4, CONTENT_W, 6.5, "F");
          }

          doc.setFont("helvetica", isHeader ? "bold" : "normal");
          doc.setFontSize(9);
          doc.setTextColor(isHeader ? 15 : 30, isHeader ? 23 : 41, isHeader ? 42 : 59);

          for (let ci = 0; ci < maxCols; ci++) {
            const cell = processPdfText(rows[ri][ci] ?? "");
            const cx = ML + ci * colW;
            // Tronquer si trop long
            const maxW = colW - 2;
            const cellLines = doc.splitTextToSize(cell, maxW) as string[];
            doc.text(cellLines[0] ?? "", cx + 1, y);
          }

          // Bordures basse
          doc.setDrawColor(210, 218, 228);
          doc.setLineWidth(0.2);
          doc.line(ML, y + 2.5, ML + CONTENT_W, y + 2.5);

          y += 6.5;
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        y += 3;
        continue;
      }

      // ── Élément de liste - item ou • item ──
      const listMatch = line.match(/^(\s*)([-•*]|\d+[.)]) (.+)/);
      if (listMatch) {
        const indent = listMatch[1].length > 0 ? 8 : 4;
        const bullet = /^\d/.test(listMatch[2]) ? listMatch[2] : "•";
        const text = processPdfText(listMatch[3]);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(bullet, ML + indent - 3, y);
        const wrapped2 = doc.splitTextToSize(text, CONTENT_W - indent - 2) as string[];
        for (const wl of wrapped2) {
          if (y > PAGE_H - 20) newPage();
          doc.text(wl, ML + indent, y);
          y += 5.5;
        }
        i++;
        continue;
      }

      // ── Ligne bold **exercice** (toute la ligne en gras) ──
      const isBoldLine = /^\*\*[^*]+\*\*[.:)]*$/.test(line.trim()) || /^\*\*[A-Z]/.test(line.trim());
      if (isBoldLine) {
        const text = processPdfText(line);
        y += 1;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        writeWrapped(text, 0, 5.5);
        y += 1;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 41, 59);
        i++;
        continue;
      }

      // ── Ligne normale ──
      const text = processPdfText(line);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      writeWrapped(text, 0, 5.5);
      i++;
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
              {isLangueSubject && (
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
              )}
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
    <div style={{ padding: "14px 16px", maxHeight: 520, overflowY: "auto", fontSize: 13, lineHeight: 1.85, color: "#1e293b", fontFamily: "system-ui, sans-serif" }}>
      {lines.map((line, i) => {
        const t = line.trim();

        // Ligne vide
        if (!t) return <div key={i} style={{ height: 8 }} />;

        // Séparateur ---
        if (/^-{3,}$/.test(t)) {
          return <hr key={i} style={{ border: "none", borderTop: "1.5px solid #e2e8f0", margin: "10px 0" }} />;
        }

        // Titres Markdown ## ou #
        if (/^#{1,3}\s/.test(t)) {
          const txt = t.replace(/^#{1,3}\s+/, "");
          return (
            <div key={i} style={{
              fontWeight: 900, color: "#0A84FF", fontSize: 11,
              textTransform: "uppercase", letterSpacing: "0.08em",
              marginTop: 14, marginBottom: 4,
              paddingBottom: 3, borderBottom: "1.5px solid #bfdbfe",
            }}>{txt}</div>
          );
        }

        // Titres tout en MAJUSCULES (sections CORRIGÉ, PARTIE…)
        if (/^[A-ZÉÈÀÙÊÎÔÛÇ\s\d–—:/()]{4,}$/.test(t) && t.length >= 4 && !/^\d+[.)]\s/.test(t)) {
          return (
            <div key={i} style={{
              fontWeight: 800, color: "#0f172a", fontSize: 12,
              textTransform: "uppercase", letterSpacing: "0.05em",
              marginTop: 14, marginBottom: 4,
              background: "rgba(10,132,255,0.06)", padding: "4px 8px",
              borderLeft: "3px solid #0A84FF", borderRadius: "0 6px 6px 0",
            }}>{t}</div>
          );
        }

        // Listes avec tiret ou puce
        if (/^[-•*]\s/.test(t)) {
          const content = t.replace(/^[-•*]\s/, "");
          const html = content.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
          return (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2, paddingLeft: 8 }}>
              <span style={{ color: "#0A84FF", fontWeight: 900, flexShrink: 0 }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        }

        // Questions / items numérotés (1. 2. 3. ou 1) 2) A. B.)
        if (/^(\d+[.)]\s|[A-Z][.)]\s)/.test(t)) {
          const match = t.match(/^(\d+[.)]\s|[A-Z][.)]\s)/);
          const num = match?.[0] ?? "";
          const rest = t.slice(num.length);
          const html = rest.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
          return (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4, paddingLeft: 4 }}>
              <span style={{ fontWeight: 800, color: "#0A84FF", minWidth: 22, flexShrink: 0 }}>{num.trim()}</span>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        }

        // Ligne citée > blockquote
        if (/^\s*>\s/.test(line)) {
          const content = line.replace(/^\s*>\s?/, "");
          return (
            <div key={i} style={{
              borderLeft: "3px solid #0A84FF", paddingLeft: 10,
              color: "#475569", fontStyle: "italic", marginBottom: 3,
              background: "rgba(10,132,255,0.04)", padding: "3px 3px 3px 10px",
              borderRadius: "0 4px 4px 0",
            }}>{content}</div>
          );
        }

        // Ligne de tableau |...|
        if (/^\|/.test(t)) {
          if (/^\|[\s:-]+\|/.test(t)) return null; // séparateur tableau
          const cells = t.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          const isFirst = i === 0 || !lines[i - 1]?.trim().startsWith("|");
          return (
            <div key={i} style={{
              display: "flex", gap: 0, marginBottom: 1,
              background: isFirst ? "#e2e8f0" : i % 2 === 0 ? "#f8fafc" : "#fff",
              borderRadius: 4, overflow: "hidden",
            }}>
              {cells.map((c, ci) => (
                <div key={ci} style={{
                  flex: 1, padding: "4px 8px", fontSize: 12,
                  fontWeight: isFirst ? 700 : 400,
                  borderRight: ci < cells.length - 1 ? "1px solid #e2e8f0" : "none",
                }}>{c}</div>
              ))}
            </div>
          );
        }

        // Ligne normale avec gras inline **...**
        const html = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        return <div key={i} dangerouslySetInnerHTML={{ __html: html }} style={{ marginBottom: 2 }} />;
      })}
    </div>
  );
}

// ─── PDF Content Processing ───────────────────────────────────────────────────

/** Convert LaTeX math notation to plain readable text */
function latexToPlain(latex: string): string {
  return latex
    .replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^}]*)\}/g, "racine($1)")
    .replace(/\\sqrt/g, "racine")
    .replace(/\\times/g, "x")
    .replace(/\\div/g, "÷")
    .replace(/\\cdot/g, ".")
    .replace(/\\leq/g, "<=")
    .replace(/\\geq/g, ">=")
    .replace(/\\neq/g, "=/=")
    .replace(/\\approx/g, "≈")
    .replace(/\\pi/g, "pi")
    .replace(/\\infty/g, "infini")
    .replace(/\\alpha/g, "alpha")
    .replace(/\\beta/g, "beta")
    .replace(/\^\{2\}/g, "²")
    .replace(/\^\{3\}/g, "³")
    .replace(/\^\{([^}]+)\}/g, "^$1")
    .replace(/\_\{([^}]+)\}/g, "_$1")
    .replace(/\\\\/g, " ")
    .replace(/[{}\\]/g, "")
    .trim();
}

/** Strip emoji and unsupported Unicode characters (jsPDF built-in fonts only support Latin) */
function stripUnsupported(text: string): string {
  // Remove emoji ranges
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    // Keep standard Latin, accented chars, common punctuation/math
    .replace(/[^\u0000-\u024F\u00D7\u00F7\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u00B0\u00B2\u00B3\u00BC\u00BD\u00BE\u2248]/g, "");
}

/** Process a raw markdown+LaTeX line into clean plain text for PDF */
function processPdfText(text: string): string {
  let t = text;
  // Inline math: $...$ and $$...$$
  t = t.replace(/\$\$([^$]+)\$\$/g, (_, math) => latexToPlain(math));
  t = t.replace(/\$([^$\n]+)\$/g, (_, math) => latexToPlain(math));
  // Strip bold **text**
  t = t.replace(/\*\*([^*]*)\*\*/g, "$1");
  // Strip italic *text* (but not bullet list * )
  t = t.replace(/(?<!\s)\*([^*\n]+)\*(?!\s)/g, "$1");
  // Strip __bold__
  t = t.replace(/__([^_]*)__/g, "$1");
  // Strip `code`
  t = t.replace(/`([^`]*)`/g, "$1");
  // Remove unsupported chars (emoji etc)
  t = stripUnsupported(t);
  return t;
}

/** Detect if line is a table separator row like |---|---| */
function isTableSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

/** Parse a pipe-table row into cells */
function parseTableRow(line: string): string[] {
  return line.trim().split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
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

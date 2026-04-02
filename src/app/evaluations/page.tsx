"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateFR } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";
import {
  type UUID, type TeacherContext, type ClassGroup, type Course, type Apprentissage,
  type Assessment, type ParsedAssessmentCsvRow, type AssessmentCsvImportSummary,
  type ParsedAssessmentResultCsvRow, type AssessmentResultCsvImportSummary,
  type AssessmentType, type ContentStatus,
  getTeacherContext, listClassGroups, listCourses, listApprentissages, listAssessments,
  parseAssessmentsCsv, parseAssessmentResultsCsv, importAssessmentsCsv, importAssessmentResultsCsv,
  createAssessment, updateAssessment, deleteAssessment,
  upsertResult, listResultsForAssessment,
} from "./evaluations";

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}
function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toISODate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

type Tab = "toutes" | "formative" | "summative" | "archived";
const TAB_CONFIG: { id: Tab; label: string; emoji: string }[] = [
  { id: "toutes",    label: "Toutes",     emoji: "📋" },
  { id: "formative", label: "Formatives", emoji: "📊" },
  { id: "summative", label: "Sommatives", emoji: "🎓" },
  { id: "archived",  label: "Archivées",  emoji: "🗄" },
];

const NIVEAUX = ["1S (A2.2)", "2S (B1.1)", "3S (B1.2)", "4S (B2.1)", "A1", "A2", "B1", "B2", "Autre"];

// ── Matières & types d'exercices (identique à creer-evaluation) ─────────────
type SubjectDef = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  types: { id: string; label: string }[];
  niveaux: string[];
};

const SUBJECTS: SubjectDef[] = [
  {
    id: "nl", label: "Néerlandais", emoji: "🇳🇱", color: "#FF9500",
    niveaux: ["A1", "A2", "B1", "B2"],
    types: [
      { id: "lacunes", label: "Texte à trous" }, { id: "qcm", label: "QCM" },
      { id: "conjugaison", label: "Conjugaison" }, { id: "dialogue", label: "Dialogue à compléter" },
      { id: "traduction", label: "Traduction" }, { id: "vocabulaire_images", label: "Vocabulaire" },
      { id: "associer", label: "Association" }, { id: "lecture", label: "Compréhension écrite" },
      { id: "remise_ordre", label: "Remise en ordre" }, { id: "flashcards", label: "Flashcards" },
      { id: "mots_meles", label: "Mots mêlés" }, { id: "kahoot_csv", label: "Questions Kahoot" },
    ],
  },
  {
    id: "francais", label: "Français", emoji: "📖", color: "#AF52DE",
    niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"],
    types: [
      { id: "lecture_fr", label: "Compréhension à la lecture" }, { id: "expression_ecrite", label: "Expression écrite" },
      { id: "grammaire_fr", label: "Grammaire française" }, { id: "orthographe", label: "Orthographe / Dictée" },
      { id: "analyse_texte", label: "Analyse de texte littéraire" },
    ],
  },
  {
    id: "mathematiques", label: "Mathématiques", emoji: "📐", color: "#0A84FF",
    niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"],
    types: [
      { id: "calcul", label: "Exercices de calcul" }, { id: "probleme", label: "Résolution de problèmes" },
      { id: "geometrie", label: "Géométrie" }, { id: "algebre", label: "Algèbre / Équations" },
      { id: "statistiques", label: "Statistiques" },
    ],
  },
  {
    id: "sciences", label: "Sciences", emoji: "🔬", color: "#34C759",
    niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"],
    types: [
      { id: "qcm_sc", label: "QCM Sciences" }, { id: "observation", label: "Observation / Expérience" },
      { id: "schemas_sc", label: "Schémas légendés" }, { id: "protocole", label: "Protocole expérimental" },
    ],
  },
  {
    id: "histoire", label: "Histoire", emoji: "🏛️", color: "#FF3B30",
    niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"],
    types: [
      { id: "analyse_source", label: "Analyse de source" }, { id: "chronologie", label: "Chronologie" },
      { id: "qcm_hist", label: "QCM Histoire" }, { id: "synthese_hist", label: "Synthèse historique" },
    ],
  },
  {
    id: "geographie", label: "Géographie", emoji: "🗺️", color: "#00C7BE",
    niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"],
    types: [
      { id: "analyse_carte", label: "Analyse de carte" }, { id: "paysage", label: "Analyse de paysage / photo" },
      { id: "qcm_geo", label: "QCM Géographie" }, { id: "croquis", label: "Croquis / Schéma géo" },
    ],
  },
  {
    id: "en", label: "Anglais", emoji: "🇬🇧", color: "#5856D6",
    niveaux: ["A1", "A2", "B1", "B2"],
    types: [
      { id: "lacunes", label: "Texte à trous" }, { id: "qcm", label: "QCM" },
      { id: "conjugaison", label: "Conjugaison" }, { id: "dialogue", label: "Dialogue à compléter" },
      { id: "traduction", label: "Traduction" }, { id: "lecture", label: "Compréhension écrite" },
      { id: "flashcards", label: "Flashcards" },
    ],
  },
];
const COMPETENCES_FWB = [
  { id: "audition", label: "Compreh. a l audition" },
  { id: "lecture", label: "Compreh. a la lecture" },
  { id: "expression_ecrite", label: "Expression ecrite" },
  { id: "orale_sans", label: "Expression orale (sans interaction)" },
  { id: "orale_avec", label: "Expression orale (avec interaction)" },
];


type CotationType = "points" | "nisbttb";
const COTATION_OPTIONS: { id: CotationType; label: string; desc: string }[] = [
  { id: "points", label: "/ Points", desc: "Note chiffrée (ex: /20)" },
  { id: "nisbttb", label: "NI / I / S / B / TB", desc: "Évaluation par compétences" },
];

// ── Types supplémentaires ────────────────────────────────────────────────────
type SchoolTemplate = { school_name: string; teacher_name: string; address: string; logo_url: string };
const DEFAULT_SCHOOL_TEMPLATE: SchoolTemplate = { school_name: "", teacher_name: "", address: "", logo_url: "" };
type IaSource = "pure" | "cours";
type PdfFormat = "klasbook" | "perso";

// ── Modal Créer ──────────────────────────────────────────────────────────────
function CreateModal({ ctx, classes, courses, apprentissages, onCreated, onClose }: {
  ctx: TeacherContext; classes: ClassGroup[]; courses: Course[]; apprentissages: Apprentissage[];
  onCreated: () => void; onClose: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AssessmentType>("summative");
  const [date, setDate] = useState(toISODate(new Date()));
  const [maxPoints, setMaxPoints] = useState("20");
  const [cotation, setCotation] = useState<CotationType>("points");
  const [status, setStatus] = useState<ContentStatus>("draft");
  const [parentVisible, setParentVisible] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [classId, setClassId] = useState<UUID | "">(classes[0]?.id ?? "");
  const [courseId, setCourseId] = useState<UUID | "">(courses[0]?.id ?? "");
  const [apprentissageId, setApprentissageId] = useState<UUID | "">("");
  const [selectedSubject, setSelectedSubject] = useState<SubjectDef>(SUBJECTS[0]);
  const [typeExercice, setTypeExercice] = useState(SUBJECTS[0].types[0].id);
  const [competenceFWB, setCompetenceFWB] = useState(COMPETENCES_FWB[0].id);
  const [competencesEvaluees, setCompetencesEvaluees] = useState<string[]>([]);
  const [niveau, setNiveau] = useState(SUBJECTS[0].niveaux[0]);
  const [iaSource, setIaSource] = useState<IaSource>("pure");
  const [coursProf, setCoursProf] = useState("");
  const [pdfFormat, setPdfFormat] = useState<PdfFormat>("klasbook");
  const [schoolTemplate, setSchoolTemplate] = useState<SchoolTemplate>(DEFAULT_SCHOOL_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<string | null>(null);

  // Charge le canevas école depuis user_profiles
  useEffect(() => {
    async function loadTemplate() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_profiles").select("template_json, full_name").eq("id", user.id).maybeSingle();
      if (data) {
        const t = (data.template_json ?? {}) as Partial<SchoolTemplate>;
        setSchoolTemplate({
          school_name: t.school_name ?? "",
          teacher_name: t.teacher_name ?? (data.full_name ?? ""),
          address: t.address ?? "",
          logo_url: t.logo_url ?? "",
        });
      }
    }
    void loadTemplate();
  }, [supabase]);

  // Auto-sélectionne le cours correspondant à la matière choisie
  useEffect(() => {
    if (!courses.length) return;
    const match = courses.find(c => c.name.toLowerCase().includes(selectedSubject.label.toLowerCase()));
    if (match) setCourseId(match.id);
  }, [selectedSubject, courses]);

  function handleSubjectChange(subj: SubjectDef) {
    setSelectedSubject(subj);
    setTypeExercice(subj.types[0].id);
    setNiveau(subj.niveaux[0]);
  }

  const inp: React.CSSProperties = { height: 40, padding: "0 12px", borderRadius: 9, border: "1px solid #E5E7EB", fontSize: 14, width: "100%", boxSizing: "border-box" };
  const sel: React.CSSProperties = { ...inp, cursor: "pointer", background: "#FFF" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" };
  function pillStyle(active: boolean): React.CSSProperties {
    return { flex: 1, padding: "8px 0", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700,
      border: active ? "2px solid #0A84FF" : "1.5px solid #E5E7EB",
      background: active ? "#EFF6FF" : "#FFF", color: active ? "#0A63BF" : "#374151" };
  }

  async function onSubmit() {
    if (!title.trim()) return setErr("Titre obligatoire.");
    if (!classId || !courseId) return setErr("Classe et cours obligatoires.");
    setSaving(true); setErr(null);
    try {
      await createAssessment({
        ctx, title: title.trim(), type, date,
        max_points: cotation === "points" ? (Number(maxPoints) || 20) : null, weight: null, status,
        parent_visible: parentVisible, instructions: instructions.trim() || null,
        class_group_id: classId, course_id: courseId, apprentissage_id: apprentissageId || null,
        cotation_type: cotation, competences_evaluees: competencesEvaluees,
      });
      onCreated(); onClose();
    } catch (e) { setErr(toNiceError(e)); } finally { setSaving(false); }
  }

  async function onGenerer() {
    if (!title.trim()) return setErr("Donne un titre à l'évaluation d'abord.");
    setGenerating(true); setErr(null); setGenResult(null);
    try {
      const theme = instructions.trim() ? `${title.trim()} — ${instructions.trim()}` : title.trim();
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
          classe: classId ? classes.find(c => c.id === classId)?.name ?? "" : "",
          ...(iaSource === "cours" && coursProf.trim() ? { contexte_remediation: `COURS DU PROFESSEUR :\n${coursProf.trim()}` } : {}),
        }),
      });
      const data = await res.json() as { exercice?: string; titre?: string; id?: string | null; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setGenResult(data.exercice ?? "");
    } catch (e) { setErr(toNiceError(e)); } finally { setGenerating(false); }
  }

  async function onDownloadPDF() {
    if (!genResult) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PAGE_W = 210, ML = 15, MR = 15, CONTENT_W = PAGE_W - ML - MR;
    let y = 0;

    // ── En-tête selon le format choisi
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, PAGE_W, 8, "F");
    doc.setFillColor(10, 132, 255);
    doc.rect(0, 0, 60, 8, "F");
    y = 16;

    if (pdfFormat === "klasbook") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("KLASBOOK", ML, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`${selectedSubject.emoji} ${selectedSubject.label}`, ML + 40, y);
      y += 7;
    } else {
      const schoolName = schoolTemplate.school_name || "Mon École";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(schoolName.toUpperCase(), ML, y);
      y += 5;
      if (schoolTemplate.address) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
        doc.text(schoolTemplate.address, ML, y); y += 4;
      }
      if (schoolTemplate.teacher_name) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
        doc.text(`Prof : ${schoolTemplate.teacher_name}`, ML, y); y += 4;
      }
      y += 3;
    }

    // ── Ligne séparatrice
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4);
    doc.line(ML, y, PAGE_W - MR, y); y += 5;

    // ── Grille d'infos (2 colonnes)
    const COL2 = ML + CONTENT_W / 2;
    doc.setFontSize(10); doc.setTextColor(15, 23, 42);
    const className = classId ? classes.find(c => c.id === classId)?.name ?? "—" : "—";
    const cotationLabel = cotation === "points" ? `       / ${maxPoints}` : "NI  /  I  /  S  /  B  /  TB";
    const infoRows: [string, string, string, string][] = [
      ["Matière :", selectedSubject.label, "Type :", type === "summative" ? "Sommative" : type === "formative" ? "Formative" : "Évaluation"],
      ["Classe :", className, "Date :", formatDateFR(date)],
      ["Nom / Prénom :", "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _", cotation === "points" ? "Points :" : "Niveau :", cotationLabel],
    ];
    for (const [label1, val1, label2, val2] of infoRows) {
      doc.setFont("helvetica", "bold"); doc.text(label1, ML, y);
      doc.setFont("helvetica", "normal"); doc.text(val1, ML + 28, y);
      doc.setFont("helvetica", "bold"); doc.text(label2, COL2, y);
      doc.setFont("helvetica", "normal"); doc.text(val2, COL2 + 22, y);
      y += 6;
    }
    y += 4;

    // ── Titre
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(10, 132, 255);
    doc.text(title.trim(), ML, y); y += 8;

    // ── Contenu IA
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(genResult, CONTENT_W);
    for (const line of lines) {
      if (y > 280) { doc.addPage(); y = 15; }
      doc.text(line, ML, y); y += 5;
    }

    // ── Pied de page
    const pageCount = doc.getNumberOfPages();
    const footerLabel = pdfFormat === "klasbook" ? "Klasbook" : (schoolTemplate.school_name || "Mon École");
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
      doc.text(`${footerLabel} — ${selectedSubject.label} — ${formatDateFR(date)}`, ML, 290);
      doc.text(`${i} / ${pageCount}`, PAGE_W - MR - 10, 290);
    }
    doc.save(`eval-${selectedSubject.id}-${date}.pdf`);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ width: "min(760px,96vw)", background: "#fff", borderRadius: 20, boxShadow: "0 24px 64px rgba(15,23,42,.28)", overflow: "hidden", maxHeight: "92vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#FF3B30,#0A84FF)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 900 }}>✏️ Nouvelle évaluation</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>×</button>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 12, overflowY: "auto" }}>
          {err && <div style={{ padding: "9px 14px", borderRadius: 9, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)", color: "#991B1B", fontSize: 13 }}>{err}</div>}

          {/* 1. Type d'évaluation */}
          <div>
            <div style={lbl}>Type d&apos;évaluation</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["summative", "formative", "diag", "oral"] as const).map(t => (
                <button key={t} onClick={() => setType(t as AssessmentType)} style={pillStyle(type === t)}>
                  {t === "summative" ? "🎓 Sommative" : t === "formative" ? "📊 Formative" : t === "diag" ? "🔍 Diag." : "🎤 Orale"}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Matière + Classe */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={lbl}>Matière *</div>
              <select style={sel} value={selectedSubject.id}
                onChange={e => { const s = SUBJECTS.find(s => s.id === e.target.value); if (s) handleSubjectChange(s); }}>
                {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Classe / Année *</div>
              <select style={sel} value={classId} onChange={e => setClassId(e.target.value as UUID)}>
                <option value="">Choisir…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* 3. Titre / Thème */}
          <div>
            <div style={lbl}>Titre / Thème *</div>
            <input style={{ ...inp, height: 44 }} placeholder="Ex: Vocabulaire — De familie" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>

          {/* 4. Competence FWB */}
          <div>
            <div style={lbl}>Competence FWB</div>
            <select style={sel} value={competenceFWB} onChange={e => setCompetenceFWB(e.target.value)}>
              {COMPETENCES_FWB.map(c2 => <option key={c2.id} value={c2.id}>{c2.label}</option>)}
            </select>
          </div>

          {/* 4b. Niveau + Type d'exercice */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={lbl}>Niveau</div>
              <select style={sel} value={niveau} onChange={e => setNiveau(e.target.value)}>
                {selectedSubject.niveaux.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Type d&apos;exercice</div>
              <select style={sel} value={typeExercice} onChange={e => setTypeExercice(e.target.value)}>
                {selectedSubject.types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* 5. Source IA */}
          <div style={{ borderRadius: 12, border: "1px solid #E5E7EB", padding: "12px 14px", background: "#FAFAFA" }}>
            <div style={lbl}>Source pour l&apos;IA</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setIaSource("pure")} style={pillStyle(iaSource === "pure")}>✨ IA pure</button>
              <button onClick={() => setIaSource("cours")} style={pillStyle(iaSource === "cours")}>📚 Basé sur mon cours</button>
            </div>
            {iaSource === "cours" && (
              <textarea
                style={{ ...inp, height: 80, resize: "vertical", paddingTop: 9, marginTop: 10, background: "#fff" }}
                placeholder="Colle ici les notes de cours, le vocabulaire ou le texte support que l'IA doit utiliser…"
                value={coursProf}
                onChange={e => setCoursProf(e.target.value)}
              />
            )}
          </div>

          {/* 6. Cotation */}
          <div>
            <div style={lbl}>Système de cotation</div>
            <div style={{ display: "flex", gap: 8 }}>
              {COTATION_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setCotation(opt.id)}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    border: cotation === opt.id ? "2px solid #0A84FF" : "1.5px solid #E5E7EB",
                    background: cotation === opt.id ? "#EFF6FF" : "#FFF", color: cotation === opt.id ? "#0A63BF" : "#374151",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span>{opt.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: "#9CA3AF" }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 6b. Competences evaluees */}
          {cotation === "nisbttb" && (
            <div>
              <div style={lbl}>Competences evaluees</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {COMPETENCES_FWB.map(comp => (
                  <label key={comp.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer",
                    padding: "5px 10px", borderRadius: 8,
                    background: competencesEvaluees.includes(comp.id) ? "#EFF6FF" : "#F9FAFB",
                    border: competencesEvaluees.includes(comp.id) ? "1.5px solid #0A84FF" : "1px solid #E5E7EB" }}>
                    <input type="checkbox" checked={competencesEvaluees.includes(comp.id)}
                      onChange={ev => setCompetencesEvaluees(prev => ev.target.checked ? [...prev, comp.id] : prev.filter(x => x !== comp.id))} />
                    {comp.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 7. Date + Points + Statut */}
          <div style={{ display: "grid", gridTemplateColumns: cotation === "points" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
            <div>
              <div style={lbl}>Date</div>
              <input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            {cotation === "points" && (
              <div>
                <div style={lbl}>Points max</div>
                <input style={inp} value={maxPoints} onChange={e => setMaxPoints(e.target.value)} inputMode="numeric" placeholder="20" />
              </div>
            )}
            <div>
              <div style={lbl}>Statut</div>
              <select style={sel} value={status} onChange={e => setStatus(e.target.value as ContentStatus)}>
                <option value="draft">Brouillon</option>
                <option value="published">Publiée</option>
                <option value="archived">Archivée</option>
              </select>
            </div>
          </div>

          {/* 8. Format PDF */}
          <div style={{ borderRadius: 12, border: "1px solid #E5E7EB", padding: "12px 14px", background: "#FAFAFA" }}>
            <div style={lbl}>Format de sortie PDF</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPdfFormat("klasbook")} style={pillStyle(pdfFormat === "klasbook")}>🏫 Canevas Klasbook</button>
              <button onClick={() => setPdfFormat("perso")} style={pillStyle(pdfFormat === "perso")}>🎨 Canevas personnalisé</button>
            </div>
            {pdfFormat === "perso" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>Nom de l&apos;école</div>
                  <input style={{ ...inp, background: "#fff" }} value={schoolTemplate.school_name} onChange={e => setSchoolTemplate(t => ({ ...t, school_name: e.target.value }))} placeholder="Ex: Athénée Royal de…" />
                </div>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>Nom du professeur</div>
                  <input style={{ ...inp, background: "#fff" }} value={schoolTemplate.teacher_name} onChange={e => setSchoolTemplate(t => ({ ...t, teacher_name: e.target.value }))} placeholder="Ex: M. Dupont" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ ...lbl, marginBottom: 4 }}>Adresse</div>
                  <input style={{ ...inp, background: "#fff" }} value={schoolTemplate.address} onChange={e => setSchoolTemplate(t => ({ ...t, address: e.target.value }))} placeholder="Ex: Rue de la Loi 1, 1000 Bruxelles" />
                </div>
              </div>
            )}
          </div>

          {/* 9. Apprentissage + Parents */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={lbl}>Apprentissage</div>
              <select style={sel} value={apprentissageId} onChange={e => setApprentissageId(e.target.value as UUID | "")}>
                <option value="">Aucun</option>
                {apprentissages.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                <input type="checkbox" checked={parentVisible} onChange={e => setParentVisible(e.target.checked)} style={{ width: 15, height: 15 }} />
                Visible parents
              </label>
            </div>
          </div>

          {/* 10. Instructions */}
          <div>
            <div style={lbl}>Instructions / Consignes (optionnel)</div>
            <textarea style={{ ...inp, height: 68, resize: "vertical", paddingTop: 9 }} placeholder="Ex: Vocabulaire de la famille, mots de liaison, present simple…" value={instructions} onChange={e => setInstructions(e.target.value)} />
          </div>

          {/* Résultat IA */}
          {genResult && (
            <div style={{ borderRadius: 12, border: "1px solid #BBF7D0", background: "#F0FDF4", padding: "12px 14px", fontSize: 13, color: "#166534", maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap" }}>
              {genResult}
            </div>
          )}

          {/* Boutons */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingTop: 4, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onGenerer} disabled={generating || !title.trim()}
                style={{ height: 42, padding: "0 16px", borderRadius: 9, border: "none",
                  background: generating || !title.trim() ? "#E5E7EB" : "linear-gradient(135deg,#AF52DE,#0A84FF)",
                  color: generating || !title.trim() ? "#9CA3AF" : "#fff",
                  fontWeight: 700, fontSize: 13, cursor: generating || !title.trim() ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 6 }}>
                {generating ? "⏳ Génération…" : "✨ Générer avec IA"}
              </button>
              {genResult && (
                <button onClick={onDownloadPDF}
                  style={{ height: 42, padding: "0 16px", borderRadius: 9, border: "1px solid #BBF7D0",
                    background: "#F0FDF4", color: "#166534", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6 }}>
                  📄 {pdfFormat === "klasbook" ? "PDF Klasbook" : "PDF personnalisé"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ height: 38, padding: "0 14px", borderRadius: 9, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Annuler</button>
              <button onClick={onSubmit} disabled={saving}
                style={{ height: 42, padding: "0 20px", borderRadius: 9, border: "none",
                  background: saving ? "#9CA3AF" : "linear-gradient(135deg,#FF3B30,#0A84FF)",
                  color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Enregistrement…" : "✓ Créer l'évaluation"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card évaluation ──────────────────────────────────────────────────────────
function AssessmentCard({ a, apprentissageNameById, highlighted, onToggleStatus, onArchive, onDelete, onRefresh, ctx }: {
  a: Assessment; apprentissageNameById: Map<string, string>; highlighted: boolean;
  onToggleStatus: (a: Assessment) => void; onArchive: (a: Assessment) => void; onDelete: (id: UUID) => void;
  onRefresh: () => void; ctx: TeacherContext;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isFormative = a.type === "formative";

  async function handleUpload(file: File) {
    setUploading(true); setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("assessmentId", a.id);
      const res = await fetch("/api/evaluations/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadMsg("✅ Fichier uploadé");
      setTimeout(() => setUploadMsg(null), 3000);
      onRefresh();
    } catch (e) {
      setUploadMsg("❌ " + (e instanceof Error ? e.message : "Erreur"));
    } finally { setUploading(false); }
  }

  async function handleDownload() {
    if (!a.fichier_path) return;
    const res = await fetch(`/api/evaluations/upload?path=${encodeURIComponent(a.fichier_path)}`);
    const data = await res.json();
    if (data.url) { window.open(data.url, "_blank"); }
  }

  async function handleDeleteFile() {
    if (!a.fichier_path) return;
    const res = await fetch(`/api/evaluations/upload?assessmentId=${a.id}&path=${encodeURIComponent(a.fichier_path)}`, { method: "DELETE" });
    if (res.ok) { onRefresh(); }
  }

  const isPublished = a.status === "published";
  const isArchived = a.status === "archived";
  const typeColor = isFormative
    ? { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" }
    : { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" };

  return (
    <>
    <div id={`card-${a.id}`} style={{
      background: "#FFF", borderRadius: 14,
      border: highlighted ? "2px solid #0A84FF" : "1px solid #E5E7EB",
      boxShadow: highlighted ? "0 0 0 4px rgba(10,132,255,.1)" : "0 1px 3px rgba(0,0,0,.05)",
      padding: "16px 18px", transition: "box-shadow .3s",
      opacity: isArchived ? 0.7 : 1,
    }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: typeColor.bg, border: `1px solid ${typeColor.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          {isFormative ? "📊" : "🎓"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: typeColor.bg, color: typeColor.text, border: `1px solid ${typeColor.border}` }}>
              {isFormative ? "Formative" : "Sommative"}
            </span>
            {isPublished && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}>✓ Publiée</span>}
            {a.status === "draft" && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>Brouillon</span>}
            {isArchived && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB" }}>Archivée</span>}
            {a.parent_visible && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}>👪 Parents</span>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 5 }}>{a.title}</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
            {a.date && <span>📅 {formatDateFR(a.date)}</span>}
            {a.max_points && <span>🎯 {a.max_points} pts</span>}
            {a.apprentissage_id && apprentissageNameById.get(a.apprentissage_id) && (
              <span>📖 {apprentissageNameById.get(a.apprentissage_id)}</span>
            )}
          </div>
          {a.instructions && (
            <div style={{ marginTop: 7, fontSize: 12, color: "#6B7280", background: "#F9FAFB", borderRadius: 8, padding: "5px 9px", fontStyle: "italic" }}>
              {a.instructions}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
            {a.fichier_path ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#F0FDF4", borderRadius: 8, border: "1px solid #BBF7D0" }}>
                <span style={{ fontSize: 16 }}>📎</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#166534", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fichier_nom}</span>
                <button onClick={handleDownload} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid #BBF7D0", background: "#DCFCE7", color: "#166534", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>⬇ Ouvrir</button>
                <button onClick={handleDeleteFile} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid #FECACA", background: "#FEF2F2", color: "#B91C1C", cursor: "pointer", fontWeight: 600 }}>✕</button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, border: "1.5px dashed #D1D5DB", background: uploading ? "#F9FAFB" : "#FFF", color: "#9CA3AF", fontSize: 12, cursor: uploading ? "not-allowed" : "pointer", fontWeight: 500 }}>
                <span>📎</span>
                {uploading ? "Upload en cours…" : "Joindre un fichier PDF / Word"}
              </button>
            )}
            {uploadMsg && <div style={{ fontSize: 11, marginTop: 4, color: uploadMsg.startsWith("✅") ? "#166534" : "#B91C1C" }}>{uploadMsg}</div>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
          {!isArchived && (
            <button onClick={() => onToggleStatus(a)}
              style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: isPublished ? "#FFFBEB" : "#F0FDF4", cursor: "pointer", fontSize: 11, fontWeight: 700, color: isPublished ? "#92400E" : "#166534", whiteSpace: "nowrap" }}>
              {isPublished ? "↩ Brouillon" : "✓ Publier"}
            </button>
          )}
          {isArchived && (
            <button onClick={() => onToggleStatus(a)}
              style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#166534" }}>
              ↩ Restaurer
            </button>
          )}
          {!isArchived && (
            <button onClick={() => onArchive(a)}
              style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#6B7280" }}>
              🗄 Archiver
            </button>
          )}
          <button onClick={() => setResultsModalOpen(true)}
            style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid #A7F3D0", background: "#ECFDF5", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#065F46" }}>
            📊 Résultats
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#B91C1C" }}>
              🗑 Supprimer
            </button>
          ) : (
            <div style={{ display: "flex", gap: 3 }}>
              <button onClick={() => onDelete(a.id)} style={{ height: 30, padding: "0 8px", borderRadius: 8, border: "1px solid #F87171", background: "#FEF2F2", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#B91C1C" }}>Confirmer</button>
              <button onClick={() => setConfirmDelete(false)} style={{ height: 30, padding: "0 8px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 11 }}>×</button>
            </div>
          )}
        </div>
      </div>
    </div>
    {resultsModalOpen && <ResultsModal a={a} ctx={ctx} onClose={() => setResultsModalOpen(false)} />}
    </>
  );
}

// ── ResultsModal ─────────────────────────────────────────────────────────────
const NISBTTB_OPTS = ["NI", "I", "S", "B", "TB"];

function ResultsModal({ a, ctx, onClose }: { a: Assessment; ctx: TeacherContext; onClose: () => void }) {
  const [students, setStudents] = useState<Array<{ id: UUID; display_name: string }>>([]);
  const [scores, setScores] = useState<Record<UUID, { value: string; competencyScores: Record<string, string> }>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: enr } = await ctx.supabase
        .from("student_enrollments")
        .select("student_id, students(id, display_name)")
        .eq("class_group_id", a.class_group_id)
        .eq("academic_year_id", ctx.academicYearId);
      const studs = (enr ?? []).map((e: any) => e.students).filter(Boolean) as Array<{ id: UUID; display_name: string }>;
      setStudents(studs);

      const existing = await listResultsForAssessment({ ctx, assessmentId: a.id });
      const init: typeof scores = {};
      for (const s of studs) {
        const ex = existing.find(r => r.student_id === s.id);
        const cs: Record<string, string> = {};
        for (const comp of (a.competences_evaluees ?? [])) {
          cs[comp] = ex?.competency_scores?.[comp] != null ? String(ex.competency_scores[comp]) : "";
        }
        init[s.id] = { value: ex?.value != null ? String(ex.value) : "", competencyScores: cs };
      }
      setScores(init);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true); setMsg(null);
    try {
      for (const s of students) {
        const row = scores[s.id];
        if (!row) continue;
        const val = row.value !== "" ? Number(row.value) : null;
        const cs: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(row.competencyScores)) {
          if (v !== "") cs[k] = a.cotation_type === "nisbttb" ? v : Number(v);
        }
        await upsertResult({ ctx, assessmentId: a.id, studentId: s.id, value: val, competencyScores: cs });
      }
      setMsg("✅ Résultats sauvegardés");
    } catch (e) {
      setMsg("❌ " + (e instanceof Error ? e.message : "Erreur"));
    } finally { setSaving(false); }
  }

  const hasComps = (a.competences_evaluees ?? []).length > 0;
  const compLabels: Record<string, string> = { audition: "Audition", lecture: "Lecture", expression_ecrite: "Écrite", orale_sans: "Orale (sans)", orale_avec: "Orale (avec)" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, minWidth: 520, maxWidth: 800, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>📊 Résultats — {a.title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid #E5E7EB" }}>Élève</th>
              {!hasComps && <th style={{ padding: "6px 10px", borderBottom: "1px solid #E5E7EB" }}>Note</th>}
              {hasComps && (a.competences_evaluees ?? []).map(c => (
                <th key={c} style={{ padding: "6px 8px", borderBottom: "1px solid #E5E7EB", textAlign: "center" }}>{compLabels[c] ?? c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "5px 10px" }}>{s.display_name}</td>
                {!hasComps && (
                  <td style={{ padding: "5px 10px", textAlign: "center" }}>
                    <input type="number" value={scores[s.id]?.value ?? ""}
                      onChange={e => setScores(prev => ({ ...prev, [s.id]: { ...prev[s.id], value: e.target.value } }))}
                      style={{ width: 60, textAlign: "center", border: "1px solid #D1D5DB", borderRadius: 6, padding: "3px 6px" }} />
                  </td>
                )}
                {hasComps && (a.competences_evaluees ?? []).map(c => (
                  <td key={c} style={{ padding: "5px 8px", textAlign: "center" }}>
                    {a.cotation_type === "nisbttb" ? (
                      <select value={scores[s.id]?.competencyScores?.[c] ?? ""}
                        onChange={e => setScores(prev => ({ ...prev, [s.id]: { ...prev[s.id], competencyScores: { ...prev[s.id]?.competencyScores, [c]: e.target.value } } }))}
                        style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "2px 4px", fontSize: 12 }}>
                        <option value="">—</option>
                        {NISBTTB_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type="number" value={scores[s.id]?.competencyScores?.[c] ?? ""}
                        onChange={e => setScores(prev => ({ ...prev, [s.id]: { ...prev[s.id], competencyScores: { ...prev[s.id]?.competencyScores, [c]: e.target.value } } }))}
                        style={{ width: 55, textAlign: "center", border: "1px solid #D1D5DB", borderRadius: 6, padding: "3px 4px" }} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "8px 20px", borderRadius: 8, background: "#6D28D9", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            {saving ? "Sauvegarde…" : "💾 Sauvegarder"}
          </button>
          {msg && <span style={{ fontSize: 13 }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function EvaluationsPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [apprentissages, setApprentissages] = useState<Apprentissage[]>([]);
  const [rows, setRows] = useState<Assessment[]>([]);
  const [filterClassId, setFilterClassId] = useState<UUID | "">("");
  const [filterCourseId, setFilterCourseId] = useState<UUID | "">("");
  const [filterAssessmentId, setFilterAssessmentId] = useState<UUID | "">("");
  const [highlightedId, setHighlightedId] = useState<UUID | "">("");
  const [activeTab, setActiveTab] = useState<Tab>("toutes");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const csvRef = useRef<HTMLInputElement | null>(null);
  const resCsvRef = useRef<HTMLInputElement | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvRows, setCsvRows] = useState<ParsedAssessmentCsvRow[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvSummary, setCsvSummary] = useState<AssessmentCsvImportSummary | null>(null);
  const [resCsvFileName, setResCsvFileName] = useState("");
  const [resCsvRows, setResCsvRows] = useState<ParsedAssessmentResultCsvRow[]>([]);
  const [resCsvImporting, setResCsvImporting] = useState(false);
  const [resCsvSummary, setResCsvSummary] = useState<AssessmentResultCsvImportSummary | null>(null);
  const [resTargetId, setResTargetId] = useState<UUID | "">("");

  const apprentissageNameById = useMemo(() => new Map(apprentissages.map(a => [a.id, a.name])), [apprentissages]);
  const stats = useMemo(() => ({
    total: rows.length,
    formatives: rows.filter(r => r.type === "formative" && r.status !== "archived").length,
    sommatives: rows.filter(r => r.type === "summative" && r.status !== "archived").length,
    publiees: rows.filter(r => r.status === "published").length,
    archivees: rows.filter(r => r.status === "archived").length,
  }), [rows]);

  const filteredRows = useMemo(() => {
    if (activeTab === "toutes") return rows.filter(r => r.status !== "archived");
    if (activeTab === "archived") return rows.filter(r => r.status === "archived");
    return rows.filter(r => r.type === activeTab && r.status !== "archived");
  }, [rows, activeTab]);

  async function boot() {
    try {
      const c = await getTeacherContext();
      setCtx(c);
      const [cls, crs, apps] = await Promise.all([listClassGroups(c), listCourses(c), listApprentissages(c)]);
      setClasses(cls); setCourses(crs); setApprentissages(apps);
      if (cls[0]?.id) setFilterClassId(cls[0].id);
      if (crs[0]?.id) setFilterCourseId(crs[0].id);
    } catch (e) { setErrorMsg(toNiceError(e)); }
  }

  async function refresh(c: TeacherContext) {
    try {
      setErrorMsg(null);
      const list = await listAssessments({ ctx: c, classGroupId: filterClassId || null, courseId: filterCourseId || null, apprentissageId: null, date: null, assessmentId: filterAssessmentId || null });
      setRows(list);
    } catch (e) { setErrorMsg(toNiceError(e)); }
  }

  useEffect(() => { boot(); }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const qClass = p.get("class_group_id") ?? "";
    const qAssessment = p.get("assessment_id") ?? "";
    if (qAssessment) setFilterAssessmentId(qAssessment as UUID);
    if (qClass) setFilterClassId(qClass as UUID);
  }, []);
  useEffect(() => { if (ctx) refresh(ctx); }, [ctx, filterClassId, filterCourseId, filterAssessmentId]);
  useEffect(() => {
    if (!filterAssessmentId) return;
    const el = document.getElementById(`card-${filterAssessmentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(filterAssessmentId);
    const t = window.setTimeout(() => setHighlightedId(""), 2500);
    return () => window.clearTimeout(t);
  }, [rows, filterAssessmentId]);

  function flash(msg: string) { setInfoMsg(msg); setTimeout(() => setInfoMsg(null), 3000); }

  async function onToggleStatus(a: Assessment) {
    if (!ctx) return;
    try {
      const next: ContentStatus = a.status === "draft" ? "published" : "draft";
      await updateAssessment({ ctx, assessmentId: a.id, patch: { status: next } });
      await refresh(ctx); flash(`"${a.title}" → ${next === "published" ? "Publiée ✓" : "Brouillon"}`);
    } catch (e) { setErrorMsg(toNiceError(e)); }
  }
  async function onArchive(a: Assessment) {
    if (!ctx) return;
    try { await updateAssessment({ ctx, assessmentId: a.id, patch: { status: "archived" } }); await refresh(ctx); flash(`"${a.title}" archivée.`); }
    catch (e) { setErrorMsg(toNiceError(e)); }
  }
  async function onDelete(id: UUID) {
    if (!ctx) return;
    try { await deleteAssessment({ ctx, assessmentId: id }); await refresh(ctx); }
    catch (e) { setErrorMsg(toNiceError(e)); }
  }
  async function onSelectCsv(file: File | null) {
    setCsvRows([]); setCsvSummary(null); setCsvFileName(file?.name ?? "");
    if (!file) return;
    try { setCsvRows(parseAssessmentsCsv(await file.text())); } catch (e) { setErrorMsg(toNiceError(e)); }
  }
  async function onImportCsv() {
    if (!ctx || !csvRows.length) return;
    try { setCsvImporting(true); const s = await importAssessmentsCsv({ ctx, rows: csvRows, classes, courses, apprentissages }); setCsvSummary(s); await refresh(ctx); flash(`Import : ${s.created} créé(s).`); }
    catch (e) { setErrorMsg(toNiceError(e)); } finally { setCsvImporting(false); }
  }
  async function onSelectResCsv(file: File | null) {
    setResCsvRows([]); setResCsvSummary(null); setResCsvFileName(file?.name ?? "");
    if (!file) return;
    try { setResCsvRows(parseAssessmentResultsCsv(await file.text())); } catch (e) { setErrorMsg(toNiceError(e)); }
  }
  async function onImportResCsv() {
    if (!ctx || !resCsvRows.length) return;
    try { setResCsvImporting(true); const s = await importAssessmentResultsCsv({ ctx, rows: resCsvRows, classes, targetAssessmentId: resTargetId || null }); setResCsvSummary(s); flash(`Import résultats : ${s.upserted} ligne(s).`); }
    catch (e) { setErrorMsg(toNiceError(e)); } finally { setResCsvImporting(false); }
  }

  const selStyle: React.CSSProperties = { height: 38, padding: "0 11px", borderRadius: 9, border: "1px solid #E5E7EB", background: "#FFF", fontSize: 13, cursor: "pointer" };
  const btnStyle: React.CSSProperties = { height: 38, padding: "0 14px", borderRadius: 9, border: "1px solid #E5E7EB", background: "#FFF", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 16, padding: "0 4px 32px" }}>
      {errorMsg && (
        <div style={{ padding: "11px 16px", borderRadius: 11, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)", color: "#991B1B", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
          {errorMsg} <button style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B", fontWeight: 900 }} onClick={() => setErrorMsg(null)}>×</button>
        </div>
      )}
      {infoMsg && (
        <div style={{ padding: "11px 16px", borderRadius: 11, background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.25)", color: "#166534", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
          {infoMsg} <button style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontWeight: 900 }} onClick={() => setInfoMsg(null)}>×</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {[
          { label: "Total",      value: stats.total,      color: "#111827", bg: "#F9FAFB" },
          { label: "Formatives", value: stats.formatives, color: "#1D4ED8", bg: "#EFF6FF" },
          { label: "Sommatives", value: stats.sommatives, color: "#6D28D9", bg: "#F5F3FF" },
          { label: "Publiées",   value: stats.publiees,   color: "#166534", bg: "#F0FDF4" },
          { label: "Archivées",  value: stats.archivees,  color: "#6B7280", bg: "#F3F4F6" },
        ].map(s => (
          <div key={s.label} style={{ borderRadius: 12, padding: "12px 14px", background: s.bg, border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB" }}>
          {TAB_CONFIG.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ flex: 1, padding: "12px 8px", background: "none", border: "none", cursor: "pointer", fontSize: 13,
                fontWeight: activeTab === tab.id ? 800 : 500, color: activeTab === tab.id ? "#111827" : "#9CA3AF",
                borderBottom: activeTab === tab.id ? "2px solid #0A84FF" : "2px solid transparent", transition: "all .15s" }}>
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>
        <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select style={selStyle} value={filterClassId} onChange={e => setFilterClassId(e.target.value as UUID)}>
            <option value="">Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={selStyle} value={filterCourseId} onChange={e => setFilterCourseId(e.target.value as UUID)}>
            <option value="">Tous les cours</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <button style={{ ...btnStyle, color: "#6B7280" }} onClick={() => setShowImport(v => !v)}>📥 Import CSV</button>
          <button onClick={() => setShowCreateModal(true)} disabled={!ctx}
            style={{ height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#FF3B30,#0A84FF)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: ctx ? "pointer" : "not-allowed" }}>
            + Nouvelle évaluation
          </button>
        </div>

        {showImport && (
          <div style={{ margin: "0 16px 16px", padding: 16, background: "#F9FAFB", borderRadius: 12, border: "1px solid #E5E7EB", display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📥 Import CSV — Évaluations</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>Colonnes : title, date, class_id/class_name, course_id/course_name</div>
            <input ref={csvRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => void onSelectCsv(e.target.files?.[0] ?? null)} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button style={btnStyle} onClick={() => csvRef.current?.click()}>Choisir CSV</button>
              <button style={{ ...btnStyle, background: csvRows.length ? "#F0FDF4" : undefined }} onClick={onImportCsv} disabled={!csvRows.length || csvImporting}>
                {csvImporting ? "Import…" : `Importer (${csvRows.length})`}
              </button>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>{csvFileName || "Aucun fichier"}</span>
            </div>
            {csvSummary && <div style={{ fontSize: 12, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 12px", color: "#166534" }}>Créés : {csvSummary.created} · Existants : {csvSummary.alreadyExisting} · Erreurs : {csvSummary.errors.length}</div>}
            <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 12, fontWeight: 700, fontSize: 14 }}>📥 Import CSV — Résultats élèves</div>
            <input ref={resCsvRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => void onSelectResCsv(e.target.files?.[0] ?? null)} />
            <select style={{ ...selStyle, maxWidth: 380 }} value={resTargetId} onChange={e => setResTargetId(e.target.value as UUID)}>
              <option value="">Évaluation cible (optionnelle)</option>
              {rows.map(a => <option key={a.id} value={a.id}>{a.title} — {formatDateFR(a.date)}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button style={btnStyle} onClick={() => resCsvRef.current?.click()}>Choisir CSV</button>
              <button style={{ ...btnStyle, background: resCsvRows.length ? "#F0FDF4" : undefined }} onClick={onImportResCsv} disabled={!resCsvRows.length || resCsvImporting}>
                {resCsvImporting ? "Import…" : `Importer résultats (${resCsvRows.length})`}
              </button>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>{resCsvFileName || "Aucun fichier"}</span>
            </div>
            {resCsvSummary && <div style={{ fontSize: 12, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 12px", color: "#166534" }}>Enregistrés : {resCsvSummary.upserted} · Doublons : {resCsvSummary.duplicatedInFile} · Erreurs : {resCsvSummary.errors.length}</div>}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {filteredRows.length === 0 ? (
          <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E5E7EB", padding: "40px 24px", textAlign: "center", color: "#6B7280" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {activeTab === "archived" ? "Aucune évaluation archivée" : "Aucune évaluation"}
            </div>
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.7 }}>
              {activeTab === "archived" ? "Les évaluations archivées apparaissent ici." : "Crée ta première évaluation avec le bouton ci-dessus."}
            </div>
          </div>
        ) : (
          filteredRows.map(a => (
            <AssessmentCard key={a.id} a={a} apprentissageNameById={apprentissageNameById}
              highlighted={a.id === highlightedId}
              onToggleStatus={onToggleStatus} onArchive={onArchive} onDelete={onDelete}
              onRefresh={() => ctx && refresh(ctx)} ctx={ctx!} />
          ))
        )}
      </div>

      {showCreateModal && ctx && (
        <CreateModal ctx={ctx} classes={classes} courses={courses} apprentissages={apprentissages}
          onCreated={() => { setFilterClassId(""); setFilterCourseId(""); setShowCreateModal(false); }}
          onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

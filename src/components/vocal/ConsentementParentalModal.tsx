"use client";

/**
 * ConsentementParentalModal
 *
 * Affiché avant toute session vocale pour un élève mineur.
 * Conforme RGPD / GDPR — Directive (UE) 2016/679, art. 8 (enfants).
 *
 * Usage :
 *   const [consenti, setConsenti] = useState(false);
 *   if (!consenti) return <ConsentementParentalModal onAccept={() => setConsenti(true)} />;
 */

import { useState } from "react";

interface Props {
  nomEleve: string;
  onAccept: () => void;
  onRefuse?: () => void;
}

export default function ConsentementParentalModal({ nomEleve, onAccept, onRefuse }: Props) {
  const [checked1, setChecked1] = useState(false);
  const [checked2, setChecked2] = useState(false);
  const [checked3, setChecked3] = useState(false);

  const peutValider = checked1 && checked2 && checked3;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: "#1e293b", borderRadius: 16, padding: 32,
        maxWidth: 540, width: "100%", border: "1px solid #334155",
        boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 32 }}>🔐</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Consentement parental</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>Requis avant la session vocale — RGPD art. 8</div>
          </div>
        </div>

        {/* Élève */}
        <div style={{
          background: "rgba(10,132,255,0.1)", border: "1px solid rgba(10,132,255,0.3)",
          borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 14,
        }}>
          Élève concerné·e : <strong>{nomEleve}</strong>
        </div>

        {/* Explication */}
        <div style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 20, lineHeight: 1.7 }}>
          Le module vocal de Klasbook utilise <strong>Azure Speech Services (Microsoft)</strong> pour analyser
          la prononciation de votre enfant. Les données audio sont :
          <ul style={{ marginTop: 8, paddingLeft: 20, color: "#94a3b8", fontSize: 13 }}>
            <li>Transmises à Microsoft Azure (région : West Europe)</li>
            <li>Non conservées au-delà du traitement immédiat</li>
            <li>Utilisées uniquement pour générer un score de prononciation</li>
            <li>Jamais revendues ni partagées à des tiers commerciaux</li>
          </ul>
        </div>

        {/* Checkboxes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          <CheckItem
            checked={checked1}
            onChange={setChecked1}
            label="Je suis le/la parent ou tuteur légal de cet élève et j'autorise l'enregistrement vocal à des fins pédagogiques."
          />
          <CheckItem
            checked={checked2}
            onChange={setChecked2}
            label="J'ai pris connaissance que les données audio sont traitées par Microsoft Azure (West Europe) et ne sont pas conservées après traitement."
          />
          <CheckItem
            checked={checked3}
            onChange={setChecked3}
            label="Je sais que je peux retirer ce consentement à tout moment en contactant l'établissement scolaire."
          />
        </div>

        {/* Droits RGPD */}
        <div style={{
          fontSize: 12, color: "#64748b", marginBottom: 20,
          borderTop: "1px solid #334155", paddingTop: 14, lineHeight: 1.6,
        }}>
          Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et d'effacement
          de vos données. Pour l'exercer : contactez votre établissement scolaire ou écrivez à{" "}
          <a href="mailto:privacy@klasbook.be" style={{ color: "#0A84FF" }}>privacy@klasbook.be</a>.
          Responsable du traitement : Klasbook / Pasquale Mamuscia, Fédération Wallonie-Bruxelles.
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onRefuse}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 8, border: "1px solid #475569",
              background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 14,
            }}
          >
            Refuser
          </button>
          <button
            onClick={peutValider ? onAccept : undefined}
            disabled={!peutValider}
            style={{
              flex: 2, padding: "12px 0", borderRadius: 8, border: "none",
              background: peutValider
                ? "linear-gradient(135deg, #0A84FF, #7c3aed)"
                : "#1e293b",
              color: peutValider ? "#fff" : "#475569",
              cursor: peutValider ? "pointer" : "not-allowed",
              fontWeight: 600, fontSize: 14,
              borderWidth: peutValider ? 0 : 1,
              borderStyle: "solid",
              borderColor: "#334155",
              transition: "all 0.2s",
            }}
          >
            ✓ J'accepte — Lancer la session vocale
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckItem({
  checked, onChange, label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label style={{ display: "flex", gap: 12, cursor: "pointer", alignItems: "flex-start" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1,
          border: checked ? "2px solid #0A84FF" : "2px solid #475569",
          background: checked ? "rgba(10,132,255,0.2)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}
      >
        {checked && <span style={{ color: "#0A84FF", fontSize: 13, fontWeight: 700 }}>✓</span>}
      </div>
      <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>{label}</span>
    </label>
  );
}

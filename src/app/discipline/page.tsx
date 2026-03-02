"use client";

import { useState } from "react";

const card: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "white",
  border: "1px solid rgba(0,0,0,0.10)",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
};

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "rgba(37,99,235,0.10)",
  borderColor: "rgba(37,99,235,0.25)",
  cursor: "pointer",
  fontWeight: 800,
};

export default function DisciplinePage() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<string[]>([]);

  function onAdd() {
    const value = text.trim();
    if (!value) return;
    setRows((prev) => [value, ...prev]);
    setText("");
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Discipline</div>
        <div style={{ opacity: 0.8 }}>Remarques de discipline (V1)</div>
      </div>

      <div style={card}>
        <div style={{ display: "grid", gap: 10 }}>
          <textarea
            style={{ ...input, minHeight: 100, resize: "vertical" }}
            placeholder="Ajouter une remarque de discipline..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div>
            <button style={btn} onClick={onAdd}>
              Ajouter
            </button>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Liste des remarques</div>
        {rows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>Aucune remarque pour l’instant.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((row, idx) => (
              <div
                key={`${idx}-${row.slice(0, 12)}`}
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 10,
                  padding: 10,
                  background: "rgba(0,0,0,0.01)",
                }}
              >
                {row}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

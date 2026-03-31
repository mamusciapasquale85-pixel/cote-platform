"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  text: string;
  langue?: string;
  label?: string;
};

type Status = "idle" | "loading" | "playing" | "error";

export default function VocalPlayer({ text, langue = "nl", label = "Écouter le modèle" }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(async () => {
    if (status === "loading") return;

    // Si déjà chargé et en lecture, on arrête
    if (status === "playing" && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setStatus("idle");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/vocal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tts", text, langue }),
      });

      if (!res.ok) throw new Error(`TTS error ${res.status}`);

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => setStatus("idle");
      audio.onerror = () => setStatus("error");

      await audio.play();
      setStatus("playing");
    } catch (e) {
      console.error(e);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }, [text, langue, status]);

  const icon = status === "loading"
    ? <SpinnerIcon />
    : status === "playing"
    ? <StopIcon />
    : <PlayIcon />;

  const bg = status === "error"
    ? "#ef4444"
    : status === "playing"
    ? "#10b981"
    : "#0A84FF";

  return (
    <button
      onClick={play}
      disabled={status === "loading"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: bg,
        color: "#fff",
        border: "none",
        borderRadius: 12,
        padding: "12px 20px",
        fontSize: 14,
        fontWeight: 600,
        cursor: status === "loading" ? "wait" : "pointer",
        transition: "background 0.2s",
        boxShadow: "0 2px 8px rgba(10,132,255,0.25)",
        minWidth: 180,
        justifyContent: "center",
      }}
    >
      {icon}
      {status === "loading" ? "Chargement…"
        : status === "playing" ? "Arrêter"
        : status === "error"   ? "Erreur — réessayer"
        : label}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
      <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round" />
    </svg>
  );
}

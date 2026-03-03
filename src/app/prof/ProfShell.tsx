"use client";

import React from "react";
import Image from "next/image";
import LogoutButton from "../teacher/LogoutButton";
import ProfTabs from "./ProfTabs";

export default function ProfShell(props: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const wrap: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "28px 16px 34px" };

  return (
    <div style={wrap} className="prof-shell-root">
      <div className="prof-header">
        <div className="prof-header-blob prof-header-blob-a" />
        <div className="prof-header-blob prof-header-blob-b" />
        <div className="prof-header-top">
          <div className="prof-title">Zone PROF</div>
          <div className="prof-header-right">
            <span className="prof-header-logo" aria-hidden="true">
              <Image
                src="/branding/logo.svg"
                alt="Lycée Alternatif Bruxellois – LAB Marie Curie"
                width={69}
                height={48}
                priority
                unoptimized
              />
            </span>
            <LogoutButton />
          </div>
        </div>
        <div className="prof-header-tabs">
          <ProfTabs />
        </div>
      </div>

      <div style={{ height: 14 }} />
      <div style={{ color: "var(--text)", opacity: 1 }}>{props.children}</div>

      <style jsx>{`
        .prof-header {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          padding: 22px 28px 24px;
          background: linear-gradient(130deg, rgba(79, 124, 255, 0.95), rgba(111, 136, 255, 0.9) 55%, rgba(155, 123, 255, 0.9));
          color: white;
          box-shadow: 0 14px 36px rgba(27, 56, 120, 0.26);
          min-height: 0;
          border: 1px solid rgba(255, 255, 255, 0.22);
        }

        .prof-header-blob {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          opacity: 0.28;
          filter: blur(2px);
        }

        .prof-header-blob-a {
          width: 320px;
          height: 160px;
          left: -80px;
          top: -70px;
          background: radial-gradient(circle at 30% 50%, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0));
        }

        .prof-header-blob-b {
          width: 260px;
          height: 140px;
          right: -50px;
          bottom: -80px;
          background: radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0));
        }

        .prof-header-top {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .prof-header-tabs {
          margin-top: 14px;
          position: relative;
          z-index: 1;
        }

        .prof-header-right {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 14px;
          margin-left: auto;
        }

        .prof-header-logo {
          display: inline-flex;
          align-items: center;
          height: 48px;
        }

        .prof-header-logo :global(img) {
          height: 48px;
          width: auto;
          object-fit: contain;
          display: block;
        }

        .prof-title {
          font-size: clamp(3rem, 5vw, 3.75rem);
          font-weight: 900;
          line-height: 1.02;
          letter-spacing: -0.02em;
          text-shadow: 0 3px 14px rgba(27, 56, 120, 0.25);
        }

        .prof-header-right :global(button) {
          min-height: 46px;
          padding: 10px 24px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.16);
          color: #fff;
          font-size: clamp(1rem, 1.2vw, 1.1rem);
          line-height: 1.1;
          font-weight: 700;
          box-shadow: 0 8px 20px rgba(27, 56, 120, 0.24);
          transition: transform 120ms ease, background 120ms ease;
        }

        .prof-header-right :global(button:hover) {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.22);
        }

        @media (max-width: 980px) {
          .prof-header {
            padding: 20px 18px 22px;
          }

          .prof-title {
            font-size: clamp(2.35rem, 6.8vw, 3.2rem);
          }
        }

        @media (max-width: 720px) {
          .prof-header-top {
            align-items: flex-start;
          }

          .prof-title {
            font-size: clamp(2.05rem, 9.2vw, 2.7rem);
          }

          .prof-header-right :global(button) {
            padding: 10px 14px;
            font-size: 0.95rem;
          }

          .prof-header-logo {
            height: 40px;
          }

          .prof-header-logo :global(img) {
            height: 40px;
          }
        }
      `}</style>
    </div>
  );
}

"use client";

import React from "react";
import LogoutButton from "../teacher/LogoutButton";
import ProfTabs from "./ProfTabs";

export default function ProfShell(props: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const wrap: React.CSSProperties = { maxWidth: 1280, margin: "0 auto", padding: "24px 16px" };

  return (
    <div style={wrap}>
      <div className="prof-header">
        <div className="prof-header-watermark" aria-hidden />

        <div className="prof-header-content">
          <div className="prof-header-left">
            <div className="prof-title">{props.title ?? "✅ Zone PROF"}</div>
            <div style={{ marginTop: 14 }}>
              <ProfTabs />
            </div>
          </div>

          <div className="prof-header-right">
            <LogoutButton />
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />
      <div style={{ color: "#171717", opacity: 1 }}>{props.children}</div>

      <style jsx>{`
        .prof-header {
          border-radius: 34px;
          padding: 22px 30px 26px 30px;
          background: linear-gradient(180deg, rgba(59, 107, 230, 0.96), rgba(130, 163, 236, 0.92));
          color: white;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
          position: relative;
          overflow: hidden;
          min-height: 220px;
        }

        .prof-header-watermark {
          position: absolute;
          right: 34px;
          top: 50%;
          transform: translateY(-45%);
          width: clamp(260px, 22vw, 360px);
          height: clamp(64px, 7vw, 96px);
          background-image: url('/branding/lab-marie-curie.png');
          background-repeat: no-repeat;
          background-position: right center;
          background-size: contain;
          opacity: 0.45;
          pointer-events: none;
          z-index: 0;
        }

        .prof-header-content {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          min-height: 160px;
        }

        .prof-header-left {
          min-width: 280px;
          max-width: 860px;
        }

        .prof-header-right {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 160px;
        }

        .prof-title {
          font-size: clamp(48px, 5.2vw, 76px);
          font-weight: 900;
          line-height: 1.04;
          letter-spacing: -0.02em;
          text-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
          margin-right: 320px;
        }

        @media (max-width: 980px) {
          .prof-title {
            margin-right: 0;
          }
        }

        @media (max-width: 720px) {
          .prof-header-watermark {
            display: none;
          }

          .prof-title {
            margin-right: 0;
          }

          .prof-header {
            min-height: auto;
          }
        }
      `}</style>
    </div>
  );
}

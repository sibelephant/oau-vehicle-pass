import React, { useState, useEffect } from "react";
import { Clock, ShieldCheck, Video, QrCode } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "20px 32px",
      borderBottom: "1px solid var(--border-subtle)",
      background: "rgba(16, 23, 38, 0.6)",
      backdropFilter: "blur(12px)",
      position: "sticky",
      top: 0,
      zIndex: 10,
    }}>
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "3px" }}>
            {subtitle}
          </p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* System Status Badges */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "rgba(255, 255, 255, 0.03)",
          padding: "6px 14px",
          borderRadius: "30px",
          border: "1px solid var(--border-subtle)",
          fontSize: "0.775rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Video size={14} color="#10b981" />
            <span style={{ color: "var(--text-muted)" }}>Main Gate ANPR</span>
            <span style={{ color: "#34d399", fontWeight: 700 }}>ONLINE</span>
          </div>

          <div style={{ width: "1px", height: "14px", background: "var(--border-subtle)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <QrCode size={14} color="#3b82f6" />
            <span style={{ color: "var(--text-muted)" }}>QR Engine</span>
            <span style={{ color: "#60a5fa", fontWeight: 700 }}>READY</span>
          </div>
        </div>

        {/* Live Clock */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          padding: "8px 14px",
          borderRadius: "8px",
          fontFamily: "var(--font-mono)",
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "var(--text-main)",
        }}>
          <Clock size={15} color="var(--primary)" />
          <span>{time}</span>
        </div>
      </div>
    </header>
  );
};

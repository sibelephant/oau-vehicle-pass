import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { Header } from "../components/Header";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Poll pending vehicle approvals count
  useEffect(() => {
    if (!user) return;
    const fetchPendingCount = async () => {
      try {
        const res = await api.getPendingVehicles();
        setPendingCount(res.data?.length || 0);
      } catch {
        // ignore background poll errors
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const getHeaderProps = () => {
    switch (location.pathname) {
      case "/gate-feed":
        return {
          title: "Live Gate Activity Stream",
          subtitle: "Real-time ANPR camera reads and QR code verifications at barrier",
        };
      case "/approvals":
        return {
          title: "Vehicle Registration Approvals",
          subtitle: "Review applications and authorize encrypted digital passes",
        };
      case "/blacklist":
        return {
          title: "Security Blacklist Registry",
          subtitle: "Barred plates and restricted campus entry alerts",
        };
      case "/":
      case "/overview":
      default:
        return {
          title: "Main Gate Telemetry & Analytics",
          subtitle: "Live surveillance, access metrics, and security overview",
        };
    }
  };

  const headerProps = getHeaderProps();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Sidebar Navigation */}
      <Sidebar pendingApprovalsCount={pendingCount} />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header title={headerProps.title} subtitle={headerProps.subtitle} />

        <main style={{ flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { Sidebar, type NavTab } from "./components/Sidebar";
import { Header } from "./components/Header";
import { OverviewView } from "./views/OverviewView";
import { GateFeedView } from "./views/GateFeedView";
import { ApprovalsView } from "./views/ApprovalsView";
import { BlacklistView } from "./views/BlacklistView";
import { LoginView } from "./views/LoginView";
import { authClient, type SessionUser } from "./lib/auth-client";
import { api } from "./lib/api";
import "./index.css";

export const App: React.FC = () => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentTab, setCurrentTab] = useState<NavTab>("overview");
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await authClient.getSession();
        const sessionUser = session?.data?.user as SessionUser | undefined;
        if (sessionUser && (sessionUser.role === "admin" || sessionUser.role === "gate_officer")) {
          setUser(sessionUser);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Session check failed:", err);
      } finally {
        setAuthChecked(true);
      }
    };

    checkSession();
  }, []);

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

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } catch {
      // ignore
    }
    setUser(null);
  };

  if (!authChecked) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-muted)",
        fontFamily: "var(--font-body)",
        gap: "12px",
      }}>
        <div className="pulse-indicator" style={{ width: "12px", height: "12px" }} />
        <span>Initializing Security Command Center...</span>
      </div>
    );
  }

  // If unauthenticated, present the Command Portal Login
  if (!user) {
    return <LoginView onSuccess={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  const getHeaderProps = () => {
    switch (currentTab) {
      case "overview":
        return {
          title: "Main Gate Telemetry & Analytics",
          subtitle: "Live surveillance, access metrics, and security overview",
        };
      case "gate-feed":
        return {
          title: "Live Gate Activity Stream",
          subtitle: "Real-time ANPR camera reads and QR code verifications at barrier",
        };
      case "approvals":
        return {
          title: "Vehicle Registration Approvals",
          subtitle: "Review applications and authorize encrypted digital passes",
        };
      case "blacklist":
        return {
          title: "Security Blacklist Registry",
          subtitle: "Barred plates and restricted campus entry alerts",
        };
    }
  };

  const headerProps = getHeaderProps();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        user={user}
        onSignOut={handleSignOut}
        pendingApprovalsCount={pendingCount}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header title={headerProps.title} subtitle={headerProps.subtitle} />

        <main style={{ flex: 1 }}>
          {currentTab === "overview" && <OverviewView />}
          {currentTab === "gate-feed" && <GateFeedView />}
          {currentTab === "approvals" && <ApprovalsView />}
          {currentTab === "blacklist" && <BlacklistView />}
        </main>
      </div>
    </div>
  );
};

export default App;

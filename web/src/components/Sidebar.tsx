import React from "react";
import {
  LayoutDashboard,
  Car,
  Ban,
  LogOut,
  ShieldCheck,
  Radio,
} from "lucide-react";
import type { SessionUser } from "../lib/auth-client";

export type NavTab = "overview" | "gate-feed" | "approvals" | "blacklist";

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: SessionUser | null;
  onSignOut: () => void;
  pendingApprovalsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  user,
  onSignOut,
  pendingApprovalsCount = 0,
}) => {
  const navItems = [
    {
      id: "overview" as NavTab,
      label: "Overview & Analytics",
      icon: LayoutDashboard,
    },
    {
      id: "gate-feed" as NavTab,
      label: "Live Gate Feed",
      icon: Radio,
      badge: "LIVE",
      badgeColor: "success",
    },
    {
      id: "approvals" as NavTab,
      label: "Vehicle Approvals",
      icon: Car,
      count: pendingApprovalsCount,
    },
    {
      id: "blacklist" as NavTab,
      label: "Blacklist Registry",
      icon: Ban,
    },
  ];

  return (
    <aside
      style={{
        width: "280px",
        minWidth: "280px",
        background: "#001a38",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100vh",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Top Branding */}
      <div>
        <div
          style={{
            padding: "24px 20px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "#002147",
              border: "2px solid #d4af37",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 16px rgba(212, 175, 55, 0.3)",
            }}
          >
            <ShieldCheck size={24} color="#d4af37" />
          </div>
          <div>
            <h2
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              OAU Campus Pass
            </h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "2px",
              }}
            >
              <span className="pulse-indicator" />
              <span
                style={{
                  fontSize: "0.725rem",
                  color: "var(--accent-cyan)",
                  fontWeight: 600,
                }}
              >
                SECURITY COMMAND
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav
          style={{
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div
            style={{
              padding: "8px 12px 6px",
              fontSize: "0.7rem",
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--text-dim)",
            }}
          >
            Main Menu
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: isActive
                    ? "rgba(212, 175, 55, 0.12)"
                    : "transparent",
                  color: isActive ? "#f5c542" : "var(--text-muted)",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                  outline: "none",
                  borderLeft: isActive
                    ? "3px solid #d4af37"
                    : "3px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.04)";
                    e.currentTarget.style.color = "var(--text-main)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <Icon
                    size={18}
                    color={isActive ? "#f5c542" : "currentColor"}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`badge badge-${item.badgeColor}`}
                    style={{ padding: "2px 6px", fontSize: "0.65rem" }}
                  >
                    {item.badge}
                  </span>
                )}

                {typeof item.count === "number" && item.count > 0 && (
                  <span
                    style={{
                      background: "rgba(245, 158, 11, 0.2)",
                      color: "#fbbf24",
                      border: "1px solid rgba(245, 158, 11, 0.4)",
                      padding: "2px 7px",
                      borderRadius: "10px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Section & Logout */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid var(--border-subtle)",
          background: "#001633",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "#002147",
              border: "2px solid #d4af37",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "0.85rem",
              color: "#f5c542",
            }}
          >
            {user?.name ? user.name.slice(0, 2).toUpperCase() : "AD"}
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-main)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.name || "Security Officer"}
            </div>
            <div
              style={{
                fontSize: "0.725rem",
                color: "var(--text-muted)",
                textTransform: "capitalize",
              }}
            >
              {user?.role?.replace("_", " ") || "Admin"}
            </div>
          </div>
        </div>

        <button
          onClick={onSignOut}
          className="btn btn-secondary btn-sm"
          style={{ width: "100%", justifyContent: "center" }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

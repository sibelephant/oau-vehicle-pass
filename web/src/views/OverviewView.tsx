import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  Clock,
  Activity,
  QrCode,
  Camera,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import {
  api,
  type TrafficSummary,
  type PeakHourItem,
  type AccessLogItem,
} from "../lib/api";

export const OverviewView: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [summary, setSummary] = useState<TrafficSummary>({
    totalEntries: 0,
    totalGranted: 0,
    totalDenied: 0,
    qrCount: 0,
    anprCount: 0,
    manualCount: 0,
    peakHour: null,
    peakHourCount: 0,
  });
  const [peakHours, setPeakHours] = useState<PeakHourItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<AccessLogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [sumRes, peakRes, logRes] = await Promise.all([
        api.getSummary(dateFrom || undefined, dateTo || undefined),
        api.getPeakHours(dateFrom || undefined, dateTo || undefined),
        api.getAccessLog({
          limit: 6,
          from: dateFrom || undefined,
          to: dateTo || undefined,
        }),
      ]);

      setSummary(sumRes.data);
      setPeakHours(peakRes.data || []);
      setRecentLogs(logRes.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const maxPeakCount = Math.max(...peakHours.map((p) => p.count), 1);
  const approvalRate =
    summary.totalEntries > 0
      ? Math.round((summary.totalGranted / summary.totalEntries) * 100)
      : 100;

  return (
    <div
      style={{
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "28px",
      }}
    >
      {/* Top Banner & Refresh */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            Gate Authentication Command & Metrics
          </h2>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              marginTop: "4px",
            }}
          >
            Real-time traffic flow, channel breakdown, and security alerts for
            OAU Main Gate.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="btn btn-secondary btn-sm"
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? "spin-animation" : ""} />
          <span>{refreshing ? "Refreshing..." : "Refresh Stats"}</span>
        </button>
      </div>

      <div
        className="glass-panel"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "end",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}
        >
          From
          <input
            className="form-input"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}
        >
          To
          <input
            className="form-input"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setDateFrom("");
            setDateTo("");
          }}
        >
          Reset range
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "var(--status-danger-bg)",
            border: "1px solid var(--status-danger-border)",
            color: "#fca5a5",
            fontSize: "0.85rem",
          }}
        >
          {error}
        </div>
      )}

      {/* KPI Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px",
        }}
      >
        {/* Total Crossings */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                }}
              >
                Total Gate Crossings
              </span>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  marginTop: "8px",
                  color: "#ffffff",
                }}
              >
                {summary.totalEntries.toLocaleString()}
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "rgba(59, 130, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--border-glow)",
              }}
            >
              <Activity size={22} color="var(--primary)" />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "14px",
              fontSize: "0.8rem",
              color: "var(--text-muted)",
            }}
          >
            <span
              style={{
                color: "#34d399",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
              }}
            >
              <TrendingUp size={14} style={{ marginRight: "2px" }} />{" "}
              {approvalRate}%
            </span>
            <span>clearance rate</span>
          </div>
        </div>

        {/* Granted Access */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                }}
              >
                Granted Entries
              </span>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  marginTop: "8px",
                  color: "#34d399",
                }}
              >
                {summary.totalGranted.toLocaleString()}
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "var(--status-success-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--status-success-border)",
              }}
            >
              <ShieldCheck size={22} color="#10b981" />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "14px",
              fontSize: "0.8rem",
              color: "var(--text-muted)",
            }}
          >
            <span>Verified passes & permitted plates</span>
          </div>
        </div>

        {/* Denied / Flagged */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                }}
              >
                Denied / Breaches
              </span>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  marginTop: "8px",
                  color: "#f87171",
                }}
              >
                {summary.totalDenied.toLocaleString()}
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "var(--status-danger-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--status-danger-border)",
              }}
            >
              <ShieldAlert size={22} color="#ef4444" />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "14px",
              fontSize: "0.8rem",
              color: "var(--text-muted)",
            }}
          >
            <span>Unregistered or blacklisted flags</span>
          </div>
        </div>

        {/* Peak Hour */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                }}
              >
                Peak Traffic Window
              </span>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  marginTop: "8px",
                  color: "#fbbf24",
                }}
              >
                {summary.peakHour !== null ? `${summary.peakHour}:00` : "08:00"}
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "var(--status-warning-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--status-warning-border)",
              }}
            >
              <Clock size={22} color="#f59e0b" />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "14px",
              fontSize: "0.8rem",
              color: "var(--text-muted)",
            }}
          >
            <span>{summary.peakHourCount} vehicles logged during rush</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Channel Breakdown + Peak Hours Chart */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.6fr",
          gap: "24px",
        }}
      >
        {/* Verification Channels Breakdown */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <h3
            style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "6px" }}
          >
            Dual-Channel Verification Share
          </h3>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              marginBottom: "20px",
            }}
          >
            Comparison of QR vs ALPD/ANPR vs Manual fallback
          </p>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {/* QR Channel */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.825rem",
                  marginBottom: "6px",
                }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <QrCode size={15} color="#d4af37" />
                  <strong>QR Digital Pass</strong>
                </span>
                <span
                  className="mono-text"
                  style={{ color: "var(--text-muted)" }}
                >
                  {summary.qrCount} (
                  {summary.totalEntries > 0
                    ? Math.round((summary.qrCount / summary.totalEntries) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div
                style={{
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.08)",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${summary.totalEntries > 0 ? (summary.qrCount / summary.totalEntries) * 100 : 0}%`,
                    background: "#d4af37",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>

            {/* ANPR Channel */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.825rem",
                  marginBottom: "6px",
                }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Camera size={15} color="#06b6d4" />
                  <strong>ANPR Camera Match</strong>
                </span>
                <span
                  className="mono-text"
                  style={{ color: "var(--text-muted)" }}
                >
                  {summary.anprCount} (
                  {summary.totalEntries > 0
                    ? Math.round(
                        (summary.anprCount / summary.totalEntries) * 100,
                      )
                    : 0}
                  %)
                </span>
              </div>
              <div
                style={{
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.08)",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${summary.totalEntries > 0 ? (summary.anprCount / summary.totalEntries) * 100 : 0}%`,
                    background: "#0284c7",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>

            {/* Manual Override */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.825rem",
                  marginBottom: "6px",
                }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <UserCheck size={15} color="#f59e0b" />
                  <strong>Manual Officer Override</strong>
                </span>
                <span
                  className="mono-text"
                  style={{ color: "var(--text-muted)" }}
                >
                  {summary.manualCount} (
                  {summary.totalEntries > 0
                    ? Math.round(
                        (summary.manualCount / summary.totalEntries) * 100,
                      )
                    : 0}
                  %)
                </span>
              </div>
              <div
                style={{
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.08)",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${summary.totalEntries > 0 ? (summary.manualCount / summary.totalEntries) * 100 : 0}%`,
                    background: "#f59e0b",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "24px",
              padding: "12px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.775rem",
              color: "var(--text-muted)",
              lineHeight: 1.6,
            }}
          >
            💡 <strong>System Note:</strong> The study’s dual-channel approach
            ensures that when plate reading is impeded by rain or headlight
            glare, the QR pass acts as an instantaneous fallback.
          </div>
        </div>

        {/* Hourly Traffic Distribution */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px",
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
              Peak-Hours Traffic Volume
            </h3>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-dim)",
                textTransform: "uppercase",
              }}
            >
              24-Hour Gate Profile
            </span>
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              marginBottom: "24px",
            }}
          >
            Vehicle entries distributed by hour of day (Main Gate)
          </p>

          {/* Bar Chart Visualizer */}
          <div
            style={{
              height: "180px",
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
              paddingBottom: "24px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            {peakHours.map((item) => {
              const heightPct = Math.round((item.count / maxPeakCount) * 100);
              const isPeak = item.count === maxPeakCount;
              return (
                <div
                  key={item.hour}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    height: "100%",
                    justifyContent: "flex-end",
                  }}
                  title={`${item.hour}:00 - ${item.count} vehicles`}
                >
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: isPeak ? "#fbbf24" : "var(--text-dim)",
                      fontWeight: isPeak ? 700 : 500,
                    }}
                  >
                    {item.count}
                  </span>
                  <div
                    style={{
                      width: "100%",
                      height: `${Math.max(heightPct, 6)}%`,
                      background: isPeak
                        ? "#d4af37"
                        : "#0a356e",
                      borderRadius: "4px 4px 0 0",
                      transition: "height 0.4s ease",
                      cursor: "pointer",
                      boxShadow: isPeak
                        ? "0 0 12px rgba(212, 175, 55, 0.4)"
                        : "none",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {item.hour}h
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Gate Activity Preview */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
              Recent Gate Security Events
            </h3>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginTop: "2px",
              }}
            >
              Most recent verifications and flag alerts recorded at the campus
              barrier
            </p>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Plate Number</th>
                <th>Category</th>
                <th>Channel</th>
                <th>Decision</th>
                <th>Security Officer</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: "32px",
                      color: "var(--text-dim)",
                    }}
                  >
                    No recent gate events recorded yet.
                  </td>
                </tr>
              ) : (
                recentLogs.map((item) => (
                  <tr key={item.log.id}>
                    <td
                      className="mono-text"
                      style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                    >
                      {new Date(item.log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td>
                      <span className="plate-pill">{item.log.plateNumber}</span>
                    </td>
                    <td>
                      <span
                        style={{
                          textTransform: "capitalize",
                          fontSize: "0.85rem",
                          color: "var(--text-main)",
                        }}
                      >
                        {item.vehicle?.category || "Unknown"}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge badge-neutral"
                        style={{ textTransform: "uppercase" }}
                      >
                        {item.log.channel}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${item.log.decision === "granted" ? "success" : "danger"}`}
                      >
                        {item.log.decision}
                      </span>
                    </td>
                    <td
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {item.officerName || "Auto Gate System"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

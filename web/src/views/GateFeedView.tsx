import React, { useState, useEffect, useCallback } from "react";
import {
  Radio,
  Search,
  RefreshCw,
  Eye,
  Camera,
  QrCode,
  UserCheck,
  X,
  AlertTriangle,
} from "lucide-react";
import { api, type AccessLogItem } from "../lib/api";

export const GateFeedView: React.FC = () => {
  const [logs, setLogs] = useState<AccessLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<AccessLogItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setRefreshing(true);
      try {
        setError(null);
        const res = await api.getAccessLog({
          limit: 50,
          decision: decisionFilter || undefined,
          channel: channelFilter || undefined,
        });
        setLogs(res.data);
      } catch (err: any) {
        setError(err.message || "Failed to load gate logs");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [decisionFilter, channelFilter],
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh interval (5s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const filteredLogs = logs.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toUpperCase();
    return (
      item.log.plateNumber.toUpperCase().includes(q) ||
      item.vehicle?.ownerName.toUpperCase().includes(q) ||
      item.vehicle?.category?.toUpperCase().includes(q)
    );
  });

  return (
    <div
      style={{
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {/* Top Banner & Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="pulse-indicator" />
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
              Live Barrier Verification Feed
            </h2>
          </div>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              marginTop: "4px",
            }}
          >
            Direct telemetry from OAU Main Gate RFID/QR scanners and ANPR
            overhead cameras.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn btn-sm ${autoRefresh ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Radio size={14} />
            <span>{autoRefresh ? "Live Feed: ON" : "Live Feed: PAUSED"}</span>
          </button>

          <button
            onClick={() => fetchLogs(true)}
            className="btn btn-secondary btn-sm"
            disabled={refreshing}
          >
            <RefreshCw
              size={14}
              className={refreshing ? "spin-animation" : ""}
            />
            <span>{refreshing ? "Updating..." : "Refresh"}</span>
          </button>
        </div>
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

      {/* Filter Bar */}
      <div
        className="glass-panel"
        style={{
          padding: "16px 20px",
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <Search
            size={16}
            color="var(--text-dim)"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: "36px" }}
            placeholder="Search plate, owner name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Decision Filter */}
        <div style={{ width: "160px" }}>
          <select
            className="form-select"
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
          >
            <option value="">All Decisions</option>
            <option value="granted">Granted Only</option>
            <option value="denied">Denied / Flagged</option>
          </select>
        </div>

        {/* Channel Filter */}
        <div style={{ width: "160px" }}>
          <select
            className="form-select"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
          >
            <option value="">All Channels</option>
            <option value="anpr">ANPR Camera</option>
            <option value="qr">QR Digital Pass</option>
            <option value="manual">Manual Override</option>
          </select>
        </div>
      </div>

      {/* Table Feed */}
      <div className="glass-panel">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Plate Number</th>
                <th>Vehicle Details</th>
                <th>Owner / Category</th>
                <th>Verification Channel</th>
                <th>Confidence</th>
                <th>Decision</th>
                <th>Gate Officer</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-dim)",
                    }}
                  >
                    {loading
                      ? "Loading live gate records..."
                      : "No verification logs match your filters."}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => {
                  const isGranted = item.log.decision === "granted";
                  return (
                    <tr key={item.log.id}>
                      <td
                        className="mono-text"
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {new Date(item.log.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td>
                        <span className="plate-pill">
                          {item.log.plateNumber}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--text-main)",
                          }}
                        >
                          {item.vehicle
                            ? `${item.vehicle.make || ""} ${item.vehicle.model || ""}`.trim() ||
                              "Registered Vehicle"
                            : "Unregistered"}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          {item.vehicle?.color
                            ? `Color: ${item.vehicle.color}`
                            : "No color recorded"}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                          {item.vehicle?.ownerName || "Visitor / Unknown"}
                        </div>
                        <span
                          className="badge badge-neutral"
                          style={{ fontSize: "0.675rem", marginTop: "2px" }}
                        >
                          {item.vehicle?.category || "Visitor"}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {item.log.channel === "anpr" && (
                            <Camera size={14} color="#06b6d4" />
                          )}
                          {item.log.channel === "qr" && (
                            <QrCode size={14} color="#d4af37" />
                          )}
                          {item.log.channel === "manual" && (
                            <UserCheck size={14} color="#f59e0b" />
                          )}
                          <span
                            style={{
                              textTransform: "uppercase",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {item.log.channel}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="mono-text"
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          —
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge badge-${isGranted ? "success" : "danger"}`}
                        >
                          {isGranted ? "GRANTED" : "DENIED"}
                        </span>
                      </td>
                      <td
                        style={{
                          fontSize: "0.825rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {item.officerName || "Automated Gate"}
                      </td>
                      <td>
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="btn btn-secondary btn-sm"
                          title="Inspect telemetry & evidence"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "650px" }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  className={`badge badge-${selectedItem.log.decision === "granted" ? "success" : "danger"}`}
                >
                  {selectedItem.log.decision.toUpperCase()}
                </span>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                  Gate Decision Inspection
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {/* Captured Photo Evidence if available */}
              {selectedItem.log.plateImageUrl ? (
                <div>
                  <label
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    ANPR Camera Capture Frame
                  </label>
                  <div
                    style={{
                      marginTop: "6px",
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "1px solid var(--border-subtle)",
                      maxHeight: "240px",
                    }}
                  >
                    <img
                      src={selectedItem.log.plateImageUrl}
                      alt="Captured plate evidence"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px dashed var(--border-subtle)",
                    fontSize: "0.8rem",
                    color: "var(--text-dim)",
                    textAlign: "center",
                  }}
                >
                  No visual image frame attached (Channel:{" "}
                  {selectedItem.log.channel.toUpperCase()})
                </div>
              )}

              {/* Vehicle & Plate Specs */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  padding: "16px",
                  borderRadius: "10px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    Plate Number
                  </div>
                  <div style={{ marginTop: "4px" }}>
                    <span
                      className="plate-pill"
                      style={{ fontSize: "1rem", padding: "4px 10px" }}
                    >
                      {selectedItem.log.plateNumber}
                    </span>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    Confidence Score
                  </div>
                  <div
                    className="mono-text"
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "#34d399",
                      marginTop: "4px",
                    }}
                  >
                    {selectedItem.log.channel === "qr"
                      ? "Verified via QR Key"
                      : "Not recorded"}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    Registered Owner
                  </div>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: "var(--text-main)",
                      marginTop: "2px",
                    }}
                  >
                    {selectedItem.vehicle?.ownerName ||
                      "Non-Registered Visitor"}
                  </div>
                  <div
                    style={{ fontSize: "0.775rem", color: "var(--text-dim)" }}
                  >
                    {selectedItem.vehicle?.ownerContact || "No contact"}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    Category
                  </div>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: "var(--text-main)",
                      textTransform: "capitalize",
                      marginTop: "2px",
                    }}
                  >
                    {selectedItem.vehicle?.category || "Visitor"}
                  </div>
                </div>
              </div>

              {/* Denial Reason or Gate Notes */}
              {selectedItem.log.overrideReason && (
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "8px",
                    background:
                      selectedItem.log.decision === "denied"
                        ? "var(--status-danger-bg)"
                        : "var(--status-warning-bg)",
                    border: `1px solid ${selectedItem.log.decision === "denied" ? "var(--status-danger-border)" : "var(--status-warning-border)"}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color:
                        selectedItem.log.decision === "denied"
                          ? "#f87171"
                          : "#fbbf24",
                    }}
                  >
                    <AlertTriangle size={15} />
                    <span>Decision Reason / Note:</span>
                  </div>
                  <p
                    style={{
                      fontSize: "0.825rem",
                      color: "var(--text-main)",
                      marginTop: "4px",
                    }}
                  >
                    {selectedItem.log.overrideReason}
                  </p>
                </div>
              )}

              {/* Telemetry Timestamp & Officer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.775rem",
                  color: "var(--text-dim)",
                }}
              >
                <span>
                  Event Log ID:{" "}
                  <span className="mono-text">
                    {selectedItem.log.id.slice(0, 12)}...
                  </span>
                </span>
                <span>
                  Logged at:{" "}
                  {new Date(selectedItem.log.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setSelectedItem(null)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

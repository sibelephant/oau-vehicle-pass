import React, { useState, useEffect } from "react";
import { 
  Ban, 
  Search, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle, 
  AlertCircle, 
  Trash2,
  PlusCircle,
  X
} from "lucide-react";
import { api, type VehicleItem } from "../lib/api";

export const BlacklistView: React.FC = () => {
  const [blacklist, setBlacklist] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetVehicleId, setTargetVehicleId] = useState("");
  const [blacklistReason, setBlacklistReason] = useState("");
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchBlacklist = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      setActionMessage(null);
      const res = await api.getBlacklistedVehicles();
      setBlacklist(res.data);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load blacklist" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBlacklist();
  }, []);

  const handleRemoveFromBlacklist = async (item: VehicleItem) => {
    setProcessingId(item.id);
    setActionMessage(null);
    try {
      await api.setBlacklistStatus(item.id, false);
      setActionMessage({
        type: "success",
        text: `Plate ${item.plateNumber} has been removed from the blacklist.`,
      });
      setBlacklist((prev) => prev.filter((v) => v.id !== item.id));
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to remove from blacklist" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetVehicleId.trim()) return;

    setProcessingId("adding");
    try {
      await api.setBlacklistStatus(targetVehicleId.trim(), true, blacklistReason.trim() || "Security restriction");
      setActionMessage({
        type: "success",
        text: "Vehicle has been placed on the security blacklist.",
      });
      setShowAddModal(false);
      setTargetVehicleId("");
      setBlacklistReason("");
      fetchBlacklist();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to blacklist vehicle" });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredItems = blacklist.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toUpperCase();
    return (
      item.plateNumber.toUpperCase().includes(q) ||
      item.ownerName.toUpperCase().includes(q) ||
      (item.blacklistReason && item.blacklistReason.toUpperCase().includes(q))
    );
  });

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Ban size={22} color="#ef4444" />
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
              Campus Security Blacklist Registry
            </h2>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Vehicles listed here trigger an immediate red alarm and automated barrier lockdown at gate checkpoints.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-danger btn-sm"
          >
            <PlusCircle size={14} />
            <span>Blacklist Vehicle ID</span>
          </button>

          <button
            onClick={() => fetchBlacklist(true)}
            className="btn btn-secondary btn-sm"
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? "spin-animation" : ""} />
            <span>{refreshing ? "Updating..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div style={{
          padding: "14px 18px",
          borderRadius: "8px",
          background: actionMessage.type === "success" ? "var(--status-success-bg)" : "var(--status-danger-bg)",
          border: `1px solid ${actionMessage.type === "success" ? "var(--status-success-border)" : "var(--status-danger-border)"}`,
          color: actionMessage.type === "success" ? "#6ee7b7" : "#fca5a5",
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}>
          {actionMessage.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="glass-panel" style={{ padding: "16px 20px" }}>
        <div style={{ position: "relative", maxWidth: "400px" }}>
          <Search size={16} color="var(--text-dim)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: "36px" }}
            placeholder="Search blacklisted plate, owner, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Plate Number</th>
                <th>Registered Owner</th>
                <th>Category</th>
                <th>Reason for Restriction</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)" }}>
                    {loading ? "Checking blacklist database..." : "No vehicles currently blacklisted. Campus gate security clear."}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isProcessing = processingId === item.id;
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className="badge badge-danger">
                          BLACKLISTED
                        </span>
                      </td>
                      <td>
                        <span className="plate-pill">{item.plateNumber}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{item.ownerName}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.ownerContact}</div>
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ color: "#fca5a5", fontSize: "0.85rem" }}>
                        {item.blacklistReason || "Security restriction flagged by supervisor"}
                      </td>
                      <td>
                        <button
                          onClick={() => handleRemoveFromBlacklist(item)}
                          className="btn btn-secondary btn-sm"
                          disabled={isProcessing}
                          title="Revoke blacklist status"
                        >
                          <CheckCircle size={13} color="#34d399" />
                          <span>Pardon / Restore</span>
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

      {/* Add to Blacklist Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldAlert size={20} color="#ef4444" />
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                  Add Vehicle to Security Blacklist
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddBlacklist} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Vehicle ID (UUID):
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 8f6b5b50-65e3-4d43-85f4-..."
                  className="form-input"
                  value={targetVehicleId}
                  onChange={(e) => setTargetVehicleId(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Security Reason / Incident Details:
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  required
                  placeholder="e.g. Stolen vehicle report, revoked pass, reckless driving on campus..."
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                />
              </div>

              <div style={{
                padding: "16px 0 0",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px"
              }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger btn-sm"
                  disabled={processingId === "adding"}
                >
                  Confirm Blacklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

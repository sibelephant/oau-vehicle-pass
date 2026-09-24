import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  FileText,
  Eye,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  X,
} from "lucide-react";
import { api, type VehiclePendingItem } from "../lib/api";

export const ApprovalsView: React.FC = () => {
  const [vehicles, setVehicles] = useState<VehiclePendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVehicle, setSelectedVehicle] =
    useState<VehiclePendingItem | null>(null);
  const [rejectingVehicle, setRejectingVehicle] =
    useState<VehiclePendingItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchPending = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      setActionMessage(null);
      const res = await api.getPendingVehicles();
      setVehicles(res.data);
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to load pending registrations",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (vehicleItem: VehiclePendingItem) => {
    setProcessingId(vehicleItem.id);
    setActionMessage(null);
    try {
      await api.updateVehicleStatus(vehicleItem.id, "approved");
      setActionMessage({
        type: "success",
        text: `Vehicle ${vehicleItem.plateNumber} approved successfully.`,
      });
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleItem.id));
      if (selectedVehicle?.id === vehicleItem.id) setSelectedVehicle(null);
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Approval failed",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingVehicle) return;
    setProcessingId(rejectingVehicle.id);
    try {
      await api.updateVehicleStatus(
        rejectingVehicle.id,
        "rejected",
        rejectionReason.trim() || "Registration requirements not satisfied",
      );
      setActionMessage({
        type: "success",
        text: `Vehicle ${rejectingVehicle.plateNumber} was rejected.`,
      });
      setVehicles((prev) => prev.filter((v) => v.id !== rejectingVehicle.id));
      setRejectingVehicle(null);
      setRejectionReason("");
      if (selectedVehicle?.id === rejectingVehicle.id) setSelectedVehicle(null);
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Rejection failed",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toUpperCase();
    return (
      v.plateNumber.toUpperCase().includes(q) ||
      v.ownerName.toUpperCase().includes(q) ||
      v.category.toUpperCase().includes(q)
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
      {/* Top Banner */}
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
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            Vehicle Registration Approvals
          </h2>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              marginTop: "4px",
            }}
          >
            Review applicant documents, verify vehicle ownership, and authorize
            digital campus passes.
          </p>
        </div>

        <button
          onClick={() => fetchPending(true)}
          className="btn btn-secondary btn-sm"
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? "spin-animation" : ""} />
          <span>{refreshing ? "Checking..." : "Refresh"}</span>
        </button>
      </div>

      {actionMessage && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "8px",
            background:
              actionMessage.type === "success"
                ? "var(--status-success-bg)"
                : "var(--status-danger-bg)",
            border: `1px solid ${actionMessage.type === "success" ? "var(--status-success-border)" : "var(--status-danger-border)"}`,
            color: actionMessage.type === "success" ? "#6ee7b7" : "#fca5a5",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="glass-panel" style={{ padding: "16px 20px" }}>
        <div style={{ position: "relative", maxWidth: "400px" }}>
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
            placeholder="Search by plate number, owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Applications Table */}
      <div className="glass-panel">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Plate Number</th>
                <th>Applicant / Owner</th>
                <th>Category</th>
                <th>Vehicle Specs</th>
                <th>Documents</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-dim)",
                    }}
                  >
                    {loading
                      ? "Checking pending registrations..."
                      : "No pending vehicle applications to review! 🎉"}
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => {
                  const isProcessing = processingId === v.id;
                  return (
                    <tr key={v.id}>
                      <td
                        className="mono-text"
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {new Date(v.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <span className="plate-pill">{v.plateNumber}</span>
                      </td>
                      <td>
                        <div
                          style={{ fontWeight: 600, color: "var(--text-main)" }}
                        >
                          {v.ownerName}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {v.ownerContact}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge badge-info"
                          style={{ textTransform: "capitalize" }}
                        >
                          {v.category}
                        </span>
                      </td>
                      <td
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-main)",
                        }}
                      >
                        <div>
                          {v.make || "—"} {v.model || ""}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          {v.color || "Color not specified"}
                        </div>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <FileText size={15} color="#d4af37" />
                          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                            {v.documents?.length || 0} file(s)
                          </span>
                        </div>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <button
                            onClick={() => setSelectedVehicle(v)}
                            className="btn btn-secondary btn-sm"
                            title="Inspect full application and documents"
                          >
                            <Eye size={13} />
                            <span>Inspect</span>
                          </button>

                          <button
                            onClick={() => handleApprove(v)}
                            className="btn btn-success btn-sm"
                            disabled={isProcessing}
                            title="Approve and issue digital pass"
                          >
                            <CheckCircle size={13} />
                            <span>Approve</span>
                          </button>

                          <button
                            onClick={() => {
                              setRejectingVehicle(v);
                              setRejectionReason("");
                            }}
                            className="btn btn-danger btn-sm"
                            disabled={isProcessing}
                            title="Reject registration"
                          >
                            <XCircle size={13} />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Application Modal */}
      {selectedVehicle && (
        <div className="modal-overlay" onClick={() => setSelectedVehicle(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
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
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                  Registration Dossier: {selectedVehicle.plateNumber}
                </h3>
                <span
                  style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
                >
                  Submitted on{" "}
                  {new Date(selectedVehicle.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedVehicle(null)}
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
              {/* Applicant & Vehicle Cards */}
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
                    Full Name
                  </div>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      color: "var(--text-main)",
                      marginTop: "2px",
                    }}
                  >
                    {selectedVehicle.ownerName}
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
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      color: "var(--primary)",
                      marginTop: "2px",
                      textTransform: "capitalize",
                    }}
                  >
                    {selectedVehicle.category}
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
                    Contact / Phone
                  </div>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: "var(--text-main)",
                      marginTop: "2px",
                    }}
                  >
                    {selectedVehicle.ownerContact}
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
                    Vehicle Make & Model
                  </div>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: "var(--text-main)",
                      marginTop: "2px",
                    }}
                  >
                    {selectedVehicle.make || "—"} {selectedVehicle.model || ""}{" "}
                    ({selectedVehicle.color || "N/A"})
                  </div>
                </div>
              </div>

              {/* Supporting Documents */}
              <div>
                <h4
                  style={{
                    fontSize: "0.875rem",
                    marginBottom: "10px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Attached Verification Documents
                </h4>
                {selectedVehicle.documents &&
                selectedVehicle.documents.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {selectedVehicle.documents.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          borderRadius: "8px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <FileText size={18} color="var(--primary)" />
                          <div>
                            <div
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                textTransform: "capitalize",
                              }}
                            >
                              {doc.type.replace(/_/g, " ")}
                            </div>
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--text-dim)",
                              }}
                            >
                              Uploaded:{" "}
                              {new Date(doc.uploadedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ textDecoration: "none" }}
                        >
                          <ExternalLink size={12} />
                          <span>View Doc</span>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px dashed var(--border-subtle)",
                      fontSize: "0.8rem",
                      color: "var(--text-dim)",
                      textAlign: "center",
                    }}
                  >
                    No external documents attached to this application.
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                onClick={() => {
                  setRejectingVehicle(selectedVehicle);
                  setRejectionReason("");
                }}
                className="btn btn-danger btn-sm"
              >
                Reject Application
              </button>

              <button
                onClick={() => handleApprove(selectedVehicle)}
                className="btn btn-success btn-sm"
              >
                Approve & Issue Pass
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal with Note Input */}
      {rejectingVehicle && (
        <div
          className="modal-overlay"
          onClick={() => setRejectingVehicle(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "450px" }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#f87171" }}>
                Reject Vehicle Registration
              </h3>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                }}
              >
                Vehicle: <strong>{rejectingVehicle.plateNumber}</strong> (
                {rejectingVehicle.ownerName})
              </p>
            </div>

            <div style={{ padding: "24px" }}>
              <label
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Reason for Rejection (visible to applicant):
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="e.g. Unreadable ID document, invalid plate format, or missing proof of ownership..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                onClick={() => setRejectingVehicle(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="btn btn-danger btn-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

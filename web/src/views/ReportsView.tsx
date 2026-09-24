import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart3,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Clock,
  QrCode,
  Camera,
  UserCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import {
  api,
  type TrafficSummary,
  type PeakHourItem,
  type DailyTrendItem,
  type UnauthorizedStatItem,
  type AccessLogItem,
} from "../lib/api";

type DatePreset = "today" | "7d" | "30d" | "all";

export const ReportsView: React.FC = () => {
  // Filters state
  const [preset, setPreset] = useState<DatePreset>("today");
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [decisionFilter, setDecisionFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data state
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
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
  const [dailyTrends, setDailyTrends] = useState<DailyTrendItem[]>([]);
  const [unauthorizedStats, setUnauthorizedStats] = useState<UnauthorizedStatItem[]>([]);
  const [logs, setLogs] = useState<AccessLogItem[]>([]);
  const [totalLogsCount, setTotalLogsCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;
  const [chartViewMode, setChartViewMode] = useState<"decision" | "channel">("decision");
  const [error, setError] = useState<string | null>(null);

  // Apply preset dates
  const handlePresetChange = (selected: DatePreset) => {
    setPreset(selected);
    setCurrentPage(1);
    const now = new Date();
    if (selected === "today") {
      const todayStr = now.toISOString().split("T")[0];
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (selected === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setDateFrom(d.toISOString().split("T")[0]);
      setDateTo(now.toISOString().split("T")[0]);
    } else if (selected === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setDateFrom(d.toISOString().split("T")[0]);
      setDateTo(now.toISOString().split("T")[0]);
    } else {
      setDateFrom("");
      setDateTo("");
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const fromParam = dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined;
      const toParam = dateTo ? `${dateTo}T23:59:59.999Z` : undefined;

      const [sumRes, peakRes, trendRes, unauthRes, logRes] = await Promise.all([
        api.getSummary(fromParam, toParam),
        api.getPeakHours(fromParam, toParam),
        api.getDailyTrends(fromParam, toParam),
        api.getUnauthorizedStats(fromParam, toParam),
        api.getAccessLog({
          from: fromParam,
          to: toParam,
          channel: channelFilter || undefined,
          decision: decisionFilter || undefined,
          page: currentPage,
          limit: pageSize,
        }),
      ]);

      setSummary(sumRes.data);
      setPeakHours(peakRes.data || []);
      setDailyTrends(trendRes.data || []);
      setUnauthorizedStats(unauthRes.data || []);
      setLogs(logRes.data || []);
      setTotalLogsCount(logRes.total ?? logRes.data?.length ?? 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load telemetry and reporting data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateFrom, dateTo, channelFilter, decisionFilter, currentPage]);

  // Client-side search filtering on current logs page
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase().trim();
    return logs.filter(
      (item) =>
        item.log.plateNumber?.toLowerCase().includes(q) ||
        item.vehicle?.ownerName?.toLowerCase().includes(q) ||
        item.officerName?.toLowerCase().includes(q) ||
        item.log.overrideReason?.toLowerCase().includes(q),
    );
  }, [logs, searchQuery]);

  // Export filtered logs to CSV
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const fromParam = dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined;
      const toParam = dateTo ? `${dateTo}T23:59:59.999Z` : undefined;

      // Fetch up to 1000 records for the export
      const exportRes = await api.getAccessLog({
        from: fromParam,
        to: toParam,
        channel: channelFilter || undefined,
        decision: decisionFilter || undefined,
        page: 1,
        limit: 1000,
      });

      const exportData = exportRes.data || [];
      if (exportData.length === 0) {
        alert("No records available to export for the selected filters.");
        return;
      }

      const headers = [
        "Timestamp",
        "Plate Number",
        "Decision",
        "Channel",
        "Vehicle Category",
        "Owner Name",
        "Officer Name",
        "Reason / Notes",
      ];

      const csvRows = exportData.map((row) => [
        `"${new Date(row.log.timestamp).toLocaleString("en-GB")}"`,
        `"${row.log.plateNumber || row.vehicle?.plateNumber || "N/A"}"`,
        `"${row.log.decision.toUpperCase()}"`,
        `"${row.log.channel.toUpperCase()}"`,
        `"${row.vehicle?.category || "Unknown"}"`,
        `"${row.vehicle?.ownerName || "N/A"}"`,
        `"${row.officerName || "System / Auto"}"`,
        `"${(row.log.overrideReason || "").replace(/"/g, '""')}"`,
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `oau-gate-access-report-${dateFrom || "all"}-to-${dateTo || "all"}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert("Failed to generate CSV export: " + (err?.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  const grantRate =
    summary.totalEntries > 0
      ? Math.round((summary.totalGranted / summary.totalEntries) * 100)
      : 100;

  const denialRate =
    summary.totalEntries > 0
      ? Math.round((summary.totalDenied / summary.totalEntries) * 100)
      : 0;

  const totalPages = Math.ceil(totalLogsCount / pageSize) || 1;

  // Max peak count for chart scaling
  const maxHourlyCount = Math.max(...peakHours.map((p) => p.count || p.total || 0), 1);

  return (
    <div
      style={{
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "28px",
        maxWidth: "1600px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* ─── Top Control Bar: Title, Presets, Date Picker & Export ─── */}
      <div
        className="glass-panel"
        style={{
          padding: "24px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(212, 175, 55, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BarChart3 size={20} color="var(--primary)" />
            </div>
            <div>
              <h1
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Access Reports & Telemetry Audits
              </h1>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  margin: "2px 0 0",
                }}
              >
                Historical traffic patterns, peak congestion hours, authentication channel breakdown, and security alerts.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          {/* Preset Buttons */}
          <div
            style={{
              display: "flex",
              background: "var(--bg-input)",
              padding: "4px",
              borderRadius: "10px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {(["today", "7d", "30d", "all"] as DatePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePresetChange(p)}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  borderRadius: "7px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: preset === p ? "var(--primary)" : "transparent",
                  color: preset === p ? "#001229" : "var(--text-muted)",
                }}
              >
                {p === "today"
                  ? "Today"
                  : p === "7d"
                    ? "Last 7 Days"
                    : p === "30d"
                      ? "Last 30 Days"
                      : "All Time"}
              </button>
            ))}
          </div>

          {/* Date range pickers */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "10px",
                padding: "6px 12px",
              }}
            >
              <Calendar size={14} color="var(--primary)" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setPreset("all");
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-main)",
                  fontSize: "0.8rem",
                  outline: "none",
                }}
              />
              <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setPreset("all");
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-main)",
                  fontSize: "0.8rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchReports}
            disabled={loading}
            className="btn"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-main)",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "0.825rem",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Sync</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="btn"
            style={{
              background: "var(--primary)",
              color: "#001229",
              padding: "8px 16px",
              borderRadius: "10px",
              fontSize: "0.825rem",
              fontWeight: 700,
              boxShadow: "0 2px 10px rgba(212, 175, 55, 0.3)",
            }}
          >
            <Download size={15} />
            <span>{exporting ? "Exporting..." : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "16px 20px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid var(--status-danger-border)",
            borderRadius: "12px",
            color: "var(--status-danger)",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Metric KPI Cards ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "18px",
        }}
      >
        {/* Total Verifications */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
              Total Gate Verifications
            </span>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(212, 175, 55, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingUp size={18} color="var(--primary)" />
            </div>
          </div>
          <div style={{ marginTop: "14px", display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
              {summary.totalEntries.toLocaleString()}
            </span>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>events</span>
          </div>
          <div style={{ marginTop: "10px", fontSize: "0.775rem", color: "var(--text-dim)" }}>
            Aggregated over selected date interval
          </div>
        </div>

        {/* Granted Admissions */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
              Authorized Admissions
            </span>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={18} color="var(--status-success)" />
            </div>
          </div>
          <div style={{ marginTop: "14px", display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                color: "var(--status-success)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {summary.totalGranted.toLocaleString()}
            </span>
            <span
              style={{
                fontSize: "0.825rem",
                fontWeight: 700,
                color: "var(--status-success)",
                background: "rgba(16, 185, 129, 0.12)",
                padding: "2px 8px",
                borderRadius: "6px",
              }}
            >
              {grantRate}% grant rate
            </span>
          </div>
          <div style={{ marginTop: "10px", fontSize: "0.775rem", color: "var(--text-dim)" }}>
            Verified approved vehicles and valid passes
          </div>
        </div>

        {/* Denied Attempts / Security Alerts */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
              Security Rejections / Alerts
            </span>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldAlert size={18} color="var(--status-danger)" />
            </div>
          </div>
          <div style={{ marginTop: "14px", display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                color: "var(--status-danger)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {summary.totalDenied.toLocaleString()}
            </span>
            <span
              style={{
                fontSize: "0.825rem",
                fontWeight: 700,
                color: "var(--status-danger)",
                background: "rgba(239, 68, 68, 0.12)",
                padding: "2px 8px",
                borderRadius: "6px",
              }}
            >
              {denialRate}% alert rate
            </span>
          </div>
          <div style={{ marginTop: "10px", fontSize: "0.775rem", color: "var(--text-dim)" }}>
            Blacklist matches, expired QR codes, unapproved
          </div>
        </div>

        {/* Peak Congestion Hour */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
              Peak Traffic Window
            </span>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(245, 158, 11, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock size={18} color="var(--status-warning)" />
            </div>
          </div>
          <div style={{ marginTop: "14px", display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                color: "var(--status-warning)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {summary.peakHour !== null
                ? `${String(summary.peakHour).padStart(2, "0")}:00`
                : "N/A"}
            </span>
            {summary.peakHour !== null && (
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                ({summary.peakHourCount} vehicles)
              </span>
            )}
          </div>
          <div style={{ marginTop: "10px", fontSize: "0.775rem", color: "var(--text-dim)" }}>
            Busiest hourly gate entry surge
          </div>
        </div>
      </div>

      {/* ─── Channel Telemetry Split ─── */}
      <div className="glass-panel" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>
            Authentication Channel Distribution
          </h3>
          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            Dual-channel redundancy (QR Pass + ANPR Plate Recognition)
          </span>
        </div>

        {/* Progress multi-segment bar */}
        <div
          style={{
            height: "14px",
            borderRadius: "7px",
            background: "rgba(255, 255, 255, 0.05)",
            display: "flex",
            overflow: "hidden",
            marginBottom: "16px",
          }}
        >
          {summary.totalEntries > 0 ? (
            <>
              <div
                style={{
                  width: `${(summary.qrCount / summary.totalEntries) * 100}%`,
                  background: "#10b981",
                  transition: "width 0.4s ease",
                }}
                title={`QR Pass: ${summary.qrCount}`}
              />
              <div
                style={{
                  width: `${(summary.anprCount / summary.totalEntries) * 100}%`,
                  background: "#3b82f6",
                  transition: "width 0.4s ease",
                }}
                title={`ANPR: ${summary.anprCount}`}
              />
              <div
                style={{
                  width: `${(summary.manualCount / summary.totalEntries) * 100}%`,
                  background: "#f59e0b",
                  transition: "width 0.4s ease",
                }}
                title={`Manual Override: ${summary.manualCount}`}
              />
            </>
          ) : (
            <div style={{ width: "100%", background: "rgba(255, 255, 255, 0.05)" }} />
          )}
        </div>

        {/* Channel Details Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          {/* QR Code */}
          <div
            style={{
              padding: "12px 16px",
              background: "var(--bg-input)",
              borderRadius: "10px",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                background: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <QrCode size={18} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: "0.775rem", color: "var(--text-muted)" }}>QR Pass Scans</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                {summary.qrCount.toLocaleString()}{" "}
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 400 }}>
                  (
                  {summary.totalEntries > 0
                    ? Math.round((summary.qrCount / summary.totalEntries) * 100)
                    : 0}
                  %)
                </span>
              </div>
            </div>
          </div>

          {/* ANPR Plate */}
          <div
            style={{
              padding: "12px 16px",
              background: "var(--bg-input)",
              borderRadius: "10px",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                background: "rgba(59, 130, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={18} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontSize: "0.775rem", color: "var(--text-muted)" }}>ANPR Plate Matches</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                {summary.anprCount.toLocaleString()}{" "}
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 400 }}>
                  (
                  {summary.totalEntries > 0
                    ? Math.round((summary.anprCount / summary.totalEntries) * 100)
                    : 0}
                  %)
                </span>
              </div>
            </div>
          </div>

          {/* Manual Officer Override */}
          <div
            style={{
              padding: "12px 16px",
              background: "var(--bg-input)",
              borderRadius: "10px",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                background: "rgba(245, 158, 11, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserCheck size={18} color="#f59e0b" />
            </div>
            <div>
              <div style={{ fontSize: "0.775rem", color: "var(--text-muted)" }}>Manual Officer Overrides</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                {summary.manualCount.toLocaleString()}{" "}
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 400 }}>
                  (
                  {summary.totalEntries > 0
                    ? Math.round((summary.manualCount / summary.totalEntries) * 100)
                    : 0}
                  %)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Peak Hours & Hourly Distribution Chart ─── */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
              Hourly Traffic Volume Distribution (00:00 – 23:00)
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
              Visualizing campus gate peak congestion hours to assist security personnel deployment.
            </p>
          </div>

          {/* View mode toggle */}
          <div
            style={{
              display: "flex",
              background: "var(--bg-input)",
              padding: "4px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <button
              onClick={() => setChartViewMode("decision")}
              style={{
                padding: "4px 12px",
                fontSize: "0.775rem",
                fontWeight: 600,
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: chartViewMode === "decision" ? "var(--primary)" : "transparent",
                color: chartViewMode === "decision" ? "#001229" : "var(--text-muted)",
              }}
            >
              Granted vs Denied
            </button>
            <button
              onClick={() => setChartViewMode("channel")}
              style={{
                padding: "4px 12px",
                fontSize: "0.775rem",
                fontWeight: 600,
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: chartViewMode === "channel" ? "var(--primary)" : "transparent",
                color: chartViewMode === "channel" ? "#001229" : "var(--text-muted)",
              }}
            >
              Channel (QR / ANPR)
            </button>
          </div>
        </div>

        {/* 24-hour bar chart representation */}
        <div style={{ height: "240px", display: "flex", alignItems: "flex-end", gap: "8px", paddingTop: "20px" }}>
          {Array.from({ length: 24 }).map((_, hour) => {
            const dataPoint = peakHours.find((p) => p.hour === hour);
            const total = dataPoint?.count || dataPoint?.total || 0;
            const granted = dataPoint?.granted ?? (total > 0 ? total : 0);
            const denied = dataPoint?.denied ?? 0;
            const qr = dataPoint?.qr ?? 0;
            const anpr = dataPoint?.anpr ?? 0;
            const manual = dataPoint?.manual ?? 0;

            const heightPct = total > 0 ? Math.max((total / maxHourlyCount) * 100, 6) : 3;
            const isPeak = summary.peakHour === hour && total > 0;

            return (
              <div
                key={hour}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                  position: "relative",
                }}
              >
                {/* Count tooltip on top */}
                {total > 0 && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: isPeak ? "var(--primary)" : "var(--text-muted)",
                      marginBottom: "4px",
                    }}
                  >
                    {total}
                  </span>
                )}

                {/* Stacked bar */}
                <div
                  style={{
                    width: "100%",
                    height: `${heightPct}%`,
                    borderRadius: "4px 4px 0 0",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column-reverse",
                    background: total === 0 ? "rgba(255, 255, 255, 0.04)" : undefined,
                    border: isPeak ? "1px solid var(--primary)" : "none",
                    boxShadow: isPeak ? "0 0 10px rgba(212, 175, 55, 0.4)" : "none",
                    transition: "height 0.3s ease",
                  }}
                  title={`Hour ${String(hour).padStart(2, "0")}:00\nTotal: ${total}\nGranted: ${granted}\nDenied: ${denied}`}
                >
                  {total > 0 && chartViewMode === "decision" && (
                    <>
                      <div
                        style={{
                          height: `${(granted / total) * 100}%`,
                          background: isPeak ? "var(--primary)" : "var(--status-success)",
                        }}
                      />
                      {denied > 0 && (
                        <div
                          style={{
                            height: `${(denied / total) * 100}%`,
                            background: "var(--status-danger)",
                          }}
                        />
                      )}
                    </>
                  )}

                  {total > 0 && chartViewMode === "channel" && (
                    <>
                      <div
                        style={{
                          height: `${(qr / total) * 100}%`,
                          background: "#10b981",
                        }}
                      />
                      <div
                        style={{
                          height: `${(anpr / total) * 100}%`,
                          background: "#3b82f6",
                        }}
                      />
                      <div
                        style={{
                          height: `${(manual / total) * 100}%`,
                          background: "#f59e0b",
                        }}
                      />
                    </>
                  )}
                </div>

                {/* Hour label */}
                <span
                  style={{
                    fontSize: "0.65rem",
                    color: isPeak ? "var(--primary)" : "var(--text-dim)",
                    marginTop: "6px",
                    fontWeight: isPeak ? 800 : 400,
                  }}
                >
                  {String(hour).padStart(2, "0")}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "24px",
            marginTop: "20px",
            fontSize: "0.775rem",
            color: "var(--text-muted)",
          }}
        >
          {chartViewMode === "decision" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--status-success)" }} />
                <span>Granted Access</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--status-danger)" }} />
                <span>Denied / Blocked</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", border: "1px solid var(--primary)", background: "var(--primary)" }} />
                <span>Peak Window ({summary.peakHour !== null ? `${summary.peakHour}:00` : "N/A"})</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#10b981" }} />
                <span>QR Code</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#3b82f6" }} />
                <span>ANPR Camera</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#f59e0b" }} />
                <span>Manual Override</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Unauthorized Rejections & Daily Trends Row ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px" }}>
        {/* Security Rejection Reasons */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                Unauthorized Rejection Breakdown
              </h3>
              <p style={{ fontSize: "0.775rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
                Classification of flagged entry denials for security planning
              </p>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--status-danger)",
                background: "rgba(239, 68, 68, 0.12)",
                padding: "2px 8px",
                borderRadius: "6px",
                fontWeight: 700,
              }}
            >
              {summary.totalDenied} Total Alerts
            </span>
          </div>

          {unauthorizedStats.length === 0 ? (
            <div
              style={{
                padding: "36px 0",
                textAlign: "center",
                color: "var(--text-dim)",
                fontSize: "0.85rem",
              }}
            >
              No security rejections logged in this timeframe.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {unauthorizedStats.map((item, idx) => {
                const pct =
                  summary.totalDenied > 0
                    ? Math.round((item.count / summary.totalDenied) * 100)
                    : 0;

                return (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 14px",
                      background: "var(--bg-input)",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background:
                              item.channel === "qr"
                                ? "rgba(16, 185, 129, 0.15)"
                                : item.channel === "anpr"
                                  ? "rgba(59, 130, 246, 0.15)"
                                  : "rgba(245, 158, 11, 0.15)",
                            color:
                              item.channel === "qr"
                                ? "#10b981"
                                : item.channel === "anpr"
                                  ? "#3b82f6"
                                  : "#f59e0b",
                            textTransform: "uppercase",
                          }}
                        >
                          {item.channel}
                        </span>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{item.reason}</span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          fontFamily: "var(--font-mono)",
                          color: "var(--status-danger)",
                        }}
                      >
                        {item.count} ({pct}%)
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div
                      style={{
                        height: "5px",
                        background: "rgba(255, 255, 255, 0.05)",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "var(--status-danger)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Daily Access Patterns Timeline */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                Daily Access Patterns & Trends
              </h3>
              <p style={{ fontSize: "0.775rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
                Day-by-day throughput of vehicle entries across the selected window
              </p>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              {dailyTrends.length} days recorded
            </span>
          </div>

          {dailyTrends.length === 0 ? (
            <div
              style={{
                padding: "36px 0",
                textAlign: "center",
                color: "var(--text-dim)",
                fontSize: "0.85rem",
              }}
            >
              No trend data available for the chosen date range.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "280px", overflowY: "auto" }}>
              {dailyTrends.map((day) => {
                const maxDayTotal = Math.max(...dailyTrends.map((d) => d.total), 1);
                const dayPct = Math.round((day.total / maxDayTotal) * 100);

                return (
                  <div
                    key={day.date}
                    style={{
                      padding: "10px 14px",
                      background: "var(--bg-input)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8rem",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                        minWidth: "85px",
                      }}
                    >
                      {day.date}
                    </span>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          height: "6px",
                          borderRadius: "3px",
                          background: "rgba(255, 255, 255, 0.05)",
                          overflow: "hidden",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: `${(day.granted / (day.total || 1)) * dayPct}%`,
                            background: "var(--status-success)",
                          }}
                        />
                        <div
                          style={{
                            width: `${(day.denied / (day.total || 1)) * dayPct}%`,
                            background: "var(--status-danger)",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {day.total}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "var(--status-danger)" }}>
                        {day.denied > 0 ? `(${day.denied} denied)` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Detailed Access Audit Log Table ─── */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
              Immutable Gate Access Audit Log
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
              Comprehensive event log with plate recognition, verification channel, and officer details.
            </p>
          </div>

          {/* Table Filters */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
            {/* Search Input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "6px 12px",
                minWidth: "200px",
              }}
            >
              <Search size={14} color="var(--text-dim)" />
              <input
                type="text"
                placeholder="Search plate, owner, officer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-main)",
                  fontSize: "0.8rem",
                  outline: "none",
                  width: "100%",
                }}
              />
            </div>

            {/* Decision Filter */}
            <select
              value={decisionFilter}
              onChange={(e) => {
                setDecisionFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.8rem",
                borderRadius: "8px",
                padding: "6px 12px",
                outline: "none",
              }}
            >
              <option value="">All Decisions</option>
              <option value="granted">Granted Only</option>
              <option value="denied">Denied / Alerts Only</option>
            </select>

            {/* Channel Filter */}
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.8rem",
                borderRadius: "8px",
                padding: "6px 12px",
                outline: "none",
              }}
            >
              <option value="">All Channels</option>
              <option value="qr">QR Pass</option>
              <option value="anpr">ANPR Camera</option>
              <option value="manual">Manual Override</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "12px 14px" }}>Timestamp</th>
                <th style={{ padding: "12px 14px" }}>Plate Number</th>
                <th style={{ padding: "12px 14px" }}>Decision</th>
                <th style={{ padding: "12px 14px" }}>Channel</th>
                <th style={{ padding: "12px 14px" }}>Category</th>
                <th style={{ padding: "12px 14px" }}>Owner</th>
                <th style={{ padding: "12px 14px" }}>Officer</th>
                <th style={{ padding: "12px 14px" }}>Reason / Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "36px", textAlign: "center", color: "var(--text-dim)", fontSize: "0.85rem" }}>
                    {loading ? "Loading audit events..." : "No access events found matching your criteria."}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => {
                  const isGranted = item.log.decision === "granted";
                  const dateStr = new Date(item.log.timestamp).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <tr
                      key={item.log.id}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                        fontSize: "0.825rem",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {dateStr}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            background: "#001633",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            border: "1px solid #0d3366",
                            color: "#fff",
                          }}
                        >
                          {item.log.plateNumber || item.vehicle?.plateNumber || "UNKNOWN"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: isGranted
                              ? "rgba(16, 185, 129, 0.12)"
                              : "rgba(239, 68, 68, 0.12)",
                            color: isGranted ? "var(--status-success)" : "var(--status-danger)",
                            border: `1px solid ${isGranted ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                          }}
                        >
                          {isGranted ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                          {isGranted ? "GRANTED" : "DENIED"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            fontSize: "0.725rem",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background:
                              item.log.channel === "qr"
                                ? "rgba(16, 185, 129, 0.15)"
                                : item.log.channel === "anpr"
                                  ? "rgba(59, 130, 246, 0.15)"
                                  : "rgba(245, 158, 11, 0.15)",
                            color:
                              item.log.channel === "qr"
                                ? "#10b981"
                                : item.log.channel === "anpr"
                                  ? "#3b82f6"
                                  : "#f59e0b",
                            textTransform: "uppercase",
                          }}
                        >
                          {item.log.channel}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", color: "var(--text-muted)", textTransform: "capitalize" }}>
                        {item.vehicle?.category || "—"}
                      </td>
                      <td style={{ padding: "12px 14px", color: "var(--text-main)" }}>
                        {item.vehicle?.ownerName || "—"}
                      </td>
                      <td style={{ padding: "12px 14px", color: "var(--text-muted)" }}>
                        {item.officerName || "Auto Barrier"}
                      </td>
                      <td style={{ padding: "12px 14px", color: isGranted ? "var(--text-dim)" : "var(--status-danger)", maxWidth: "220px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {item.log.overrideReason || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Showing {filteredLogs.length} of {totalLogsCount} total entries (Page {currentPage} of {totalPages})
          </span>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="btn"
              style={{
                padding: "6px 12px",
                fontSize: "0.8rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                color: currentPage <= 1 ? "var(--text-dim)" : "var(--text-main)",
                borderRadius: "8px",
              }}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
              className="btn"
              style={{
                padding: "6px 12px",
                fontSize: "0.8rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                color: currentPage >= totalPages ? "var(--text-dim)" : "var(--text-main)",
                borderRadius: "8px",
              }}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;

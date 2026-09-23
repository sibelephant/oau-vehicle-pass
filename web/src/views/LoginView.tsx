import React, { useState } from "react";
import { ShieldCheck, Lock, Mail, AlertCircle, ArrowRight } from "lucide-react";
import { authClient, type SessionUser } from "../lib/auth-client";

interface LoginViewProps {
  onSuccess: (user: SessionUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (res.error) {
        setError(res.error.message || "Invalid email or password");
        setLoading(false);
        return;
      }

      // Check session role
      const session = await authClient.getSession();
      const user = session?.data?.user as SessionUser | undefined;

      if (!user) {
        setError("Failed to retrieve user session");
        setLoading(false);
        return;
      }

      if (user.role !== "admin" && user.role !== "gate_officer") {
        setError("Access restricted: This portal is for Security Officers & Administrators only.");
        await authClient.signOut();
        setLoading(false);
        return;
      }

      onSuccess(user);
    } catch (err: any) {
      setError(err.message || "Failed to authenticate. Is the server running on port 3000?");
    } finally {
      setLoading(false);
    }
  };

  // Quick fill helper for demo/testing
  const fillCredentials = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("password123");
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "radial-gradient(ellipse at 50% 30%, #172554 0%, #0a0e17 70%)",
    }}>
      <div className="glass-panel" style={{
        width: "100%",
        maxWidth: "440px",
        padding: "40px 32px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
      }}>
        {/* Brand Icon & Heading */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "60px",
            height: "60px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 30px rgba(59, 130, 246, 0.5)",
            marginBottom: "16px",
          }}>
            <ShieldCheck size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>
            Security Command Portal
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "6px" }}>
            OAU Vehicle Pass Authentication & Monitoring
          </p>
        </div>

        {error && (
          <div style={{
            padding: "12px 14px",
            borderRadius: "8px",
            background: "var(--status-danger-bg)",
            border: "1px solid var(--status-danger-border)",
            color: "#fca5a5",
            fontSize: "0.825rem",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
              Official Email Address
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={16} color="var(--text-dim)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="email"
                required
                className="form-input"
                style={{ paddingLeft: "38px" }}
                placeholder="officer@oauife.edu.ng"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={16} color="var(--text-dim)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="password"
                required
                className="form-input"
                style={{ paddingLeft: "38px" }}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "8px", padding: "12px" }}
            disabled={loading}
          >
            {loading ? "Authenticating..." : "Access Dashboard"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Quick Testing Helper */}
        <div style={{
          marginTop: "28px",
          paddingTop: "20px",
          borderTop: "1px solid var(--border-subtle)",
        }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textAlign: "center", marginBottom: "10px" }}>
            Quick Developer Preset:
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => fillCredentials("admin@oauife.edu.ng")}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem" }}
            >
              Admin Demo
            </button>
            <button
              type="button"
              onClick={() => fillCredentials("gate@oauife.edu.ng")}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem" }}
            >
              Gate Officer Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute: React.FC = () => {
  const { user, authChecked } = useAuth();
  const location = useLocation();

  if (!authChecked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-muted)",
          fontFamily: "var(--font-body)",
          gap: "12px",
        }}
      >
        <div className="pulse-indicator" style={{ width: "12px", height: "12px" }} />
        <span>Initializing Security Command Center...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

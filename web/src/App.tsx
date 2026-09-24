import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { OverviewView } from "./views/OverviewView";
import { GateFeedView } from "./views/GateFeedView";
import { ApprovalsView } from "./views/ApprovalsView";
import { BlacklistView } from "./views/BlacklistView";
import { LoginView } from "./views/LoginView";
import "./index.css";

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Authentication Route */}
      <Route path="/login" element={<LoginView />} />

      {/* Protected Security Command Center Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<OverviewView />} />
          <Route path="gate-feed" element={<GateFeedView />} />
          <Route path="approvals" element={<ApprovalsView />} />
          <Route path="blacklist" element={<BlacklistView />} />
        </Route>
      </Route>

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;

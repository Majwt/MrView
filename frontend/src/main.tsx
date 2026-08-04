import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import App from "./App";
import "./index.css";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import GraphPage from "./components/GraphPage";
import LoginPage from "./components/LoginPage";
import DashboardPage from "./components/DashboardPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";

const settingsPage = () => {

  return (
    <>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        settings will go here, but for now this is just a placeholder. You can add your settings components and logic here as needed.
      </p>
    </>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return null;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, role, isLoading } = useAuth();
  if (isLoading) return null;
  if (!token) return <Navigate to="/login" replace />;
  if (role !== "Admin") return <Navigate to="/graph" replace />;
  return <>{children}</>;
}

(async () => {
  try {
    const r = await fetch("/api/auth/config");
    if (r.ok) {
      const cfg = (await r.json()) as { oidc_authority?: string; oidc_client_id?: string; oidc_scope?: string };
      window.__APP_CONFIG__ = {
        OIDC_AUTHORITY: cfg.oidc_authority ?? "",
        OIDC_CLIENT_ID: cfg.oidc_client_id ?? "",
        OIDC_SCOPE: cfg.oidc_scope ?? "openid profile",
      };
    }
  } catch { /* non-fatal: falls back to local-only mode */ }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ThemeProvider defaultTheme="dark" storageKey="axilanswer-theme">
        <TooltipProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<ProtectedRoute><App /></ProtectedRoute>}>
                  <Route index element={<DashboardPage />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="graph" element={<GraphPage />} />
                  <Route path="customer/:customerId" element={<AdminRoute><GraphPage /></AdminRoute>} />
                  <Route path="settings" element={settingsPage()} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
})();

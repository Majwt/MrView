import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import App from "./App";
import "./index.css";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import GraphPage from "./components/GraphPage";
import LoginPage from "./components/LoginPage";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="axilanswer-theme">
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedRoute><App /></ProtectedRoute>}>
                <Route index element={<GraphPage />} />
                <Route path="graph" element={<GraphPage />} />
                <Route path="customer/:customerId" element={<AdminRoute><GraphPage /></AdminRoute>} />
                <Route path="settings" element={settingsPage()} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode >,
);

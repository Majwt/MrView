import { useAuth } from "@/auth/AuthContext";
import type { ReactNode } from "react";
import { Navigate } from "react-router";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) {
    return null;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { token, role, isLoading } = useAuth();
  if (isLoading) {
    return null;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role !== "Admin") {
    return <Navigate to="/graph" replace />;
  }

  return <>{children}</>;
}

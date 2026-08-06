import type { ProtectedRouteDef } from "@/app/router/route-types";
import { DashboardShell } from "./ui/dashboard-shell";

export const dashboardIndexRoute: ProtectedRouteDef = {
  key: "dashboard-index",
  index: true,
  element: <DashboardShell />,
};

export const dashboardRoute: ProtectedRouteDef = {
  key: "dashboard",
  path: "dashboard",
  element: <DashboardShell />,
};

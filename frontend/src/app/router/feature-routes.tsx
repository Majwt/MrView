import { customerGraphAdminRoute, graphRoute, legacyCustomerGraphAdminRoute } from "@/features/graph";
import { customerDashboardAdminRoute, dashboardIndexRoute, dashboardRoute } from "@/features/dashboard";
import SettingsPage from "@/pages/settings/settings-page";
import type { AdminRouteDef, ProtectedRouteDef } from "@/app/router/route-types";

export const protectedChildRoutes: ProtectedRouteDef[] = [
  dashboardIndexRoute,
  dashboardRoute,
  graphRoute,
  {
    key: "settings",
    path: "settings",
    element: <SettingsPage />,
  },
];

export const adminChildRoutes: AdminRouteDef[] = [
  customerDashboardAdminRoute,
  customerGraphAdminRoute,
  legacyCustomerGraphAdminRoute,
];

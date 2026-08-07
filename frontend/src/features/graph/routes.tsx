import type { AdminRouteDef, ProtectedRouteDef } from "@/app/router/route-types";
import { GraphShell, LegacyCustomerGraphRedirect } from "./ui/graph-shell";

export const graphRoute: ProtectedRouteDef = {
  key: "graph",
  path: "graph",
  element: <GraphShell />,
};

export const customerGraphAdminRoute: AdminRouteDef = {
  key: "customer-graph",
  path: "customer/:customerId/graph",
  element: <GraphShell />,
};

export const legacyCustomerGraphAdminRoute: AdminRouteDef = {
  key: "legacy-customer-graph",
  path: "customer/:customerId",
  element: <LegacyCustomerGraphRedirect />,
};

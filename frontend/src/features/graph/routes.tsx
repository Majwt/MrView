import type { AdminRouteDef, ProtectedRouteDef } from "@/app/router/route-types";
import { GraphShell } from "./ui/graph-shell";

export const graphRoute: ProtectedRouteDef = {
  key: "graph",
  path: "graph",
  element: <GraphShell />,
};

export const customerGraphAdminRoute: AdminRouteDef = {
  key: "customer-graph",
  path: "customer/:customerId",
  element: <GraphShell />,
};

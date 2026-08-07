import type { ProtectedRouteDef } from "@/app/router/route-types";
import { NewFeatureShell } from "./ui/new-feature-shell";

export const newFeatureRoute: ProtectedRouteDef = {
  key: "new-feature",
  path: "new-feature",
  element: <NewFeatureShell />,
};

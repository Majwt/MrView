import type { ReactElement } from "react";

export type ProtectedRouteDef = {
  key: string;
  path?: string;
  index?: boolean;
  element: ReactElement;
};

export type AdminRouteDef = {
  key: string;
  path: string;
  element: ReactElement;
};

import { AppRoutes } from "@/app/router/routes";
import { BrowserRouter } from "react-router";

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

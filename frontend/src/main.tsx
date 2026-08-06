import React from "react";
import ReactDOM from "react-dom/client";

import { bootstrapAppConfig } from "@/app/bootstrap";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router/app-router";
import "./index.css";

(async () => {
  await bootstrapAppConfig();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </React.StrictMode>,
  );
})();

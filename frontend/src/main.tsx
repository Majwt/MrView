import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter, Route, Routes } from "react-router";
import App from "./App";
import "./index.css";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import GraphPage from "./components/GraphPage";

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


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="axilanswer-theme">
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={<GraphPage />} />
              <Route path="graph" element={<GraphPage />} />
              <Route path="customer/:customerId" element={<GraphPage />} />
              <Route path="settings" element={settingsPage()} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode >,
);

import { Separator } from "./components/ui/separator";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { ThemeToggle } from "./components/theme-toggle";
import { Outlet } from "react-router";
import { GraphStatsProvider } from "./features/graph/GraphStatsContext";
import { SidebarTrigger } from "./components/ui/sidebar";
import React from "react";




export function App() {



  return (
    <GraphStatsProvider>
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AppSidebar />

      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
          <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
            <SidebarTrigger className="-ms-1" />
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
            <h1 className="text-base font-medium">AxiLANswer</h1>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
    </GraphStatsProvider>
  );
}

export default App;

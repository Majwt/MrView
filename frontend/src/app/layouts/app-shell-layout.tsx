import { AppSidebar } from "@/features/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GraphStatsProvider } from "@/features/graph/graph-stats-context";
import React from "react";
import { Outlet } from "react-router";

export default function AppShellLayout() {
  return (
    <GraphStatsProvider>
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 13)",
        } as React.CSSProperties}
      >
        <AppSidebar />

        <SidebarInset className="aurora-bg h-svh overflow-hidden">
          <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/70 bg-background/70 backdrop-blur-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
              <SidebarTrigger className="-ms-1" />
              <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

              <div className="ml-auto flex items-center gap-2">
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

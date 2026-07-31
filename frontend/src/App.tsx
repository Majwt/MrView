import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { ThemeToggle } from "./components/theme-toggle";
import { Outlet } from "react-router";
import { GraphStatsProvider } from "./features/graph/GraphStatsContext";




export function App() {



  return (
    <GraphStatsProvider>
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <header className="flex h-14 justify-between items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-medium "></h1>
          </div>
          <ThemeToggle />

        </header>

        <main className="grid h-[calc(100vh-3.5rem)] grid-rows-2 overflow-hidden">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
    </GraphStatsProvider>
  );
}

export default App;

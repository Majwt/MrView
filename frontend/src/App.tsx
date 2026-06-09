import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar, type sidebarSection } from "./components/AppSidebar";
import { Network, Settings, Users } from "lucide-react";
import { ThemeToggle } from "./components/theme-toggle";
import { Outlet } from "react-router";

import { useNavigate } from "react-router";



export function App() {

  const navigate = useNavigate();


  const sidebarSections: sidebarSection[] = [
    {
      title: "Graphs",
      content: [
        {
          title: "Complete Graph",
          icon: Network,
          onClick: () => {
            navigate("/graph");

          },
          page: "/graph"
        },
        {
          title: "Customer Graphs",
          icon: Users,
          onClick: () => {
            navigate("/graph/1");
          },
          page: "/graph/:customerId"
        },
      ],
    },
    {
      title: "Other things",
      content: [
        {
          title: "Settings",
          icon: Settings,
          onClick: () => {
            navigate("/settings");
          },
          page: "/settings"
        }
      ],
    }
  ];






  return (
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
  );
}

export default App;

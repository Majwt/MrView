// src/components/AppSidebar.tsx

import { Network, Settings, Users } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "./theme-toggle";

const items = [
  {
    title: "Graph",
    icon: Network,
    active: true,
  },
  {
    title: "Customer Graphs",
    icon: Users,
  },
  {
    title: "Settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-2">
          <div className="text-lg font-semibold">AxiLANswer</div>
          <div className="text-xs text-muted-foreground">Network topology</div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={item.active}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-row items-center gap-2 px-2 py-2">
          <div className="px-2 py-2 text-xs text-muted-foreground">v0.1.0</div>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

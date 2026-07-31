// src/components/AppSidebar.tsx

import { LayoutDashboard, Network } from "lucide-react";

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
import { NavLink } from "react-router";
import SidebarCustomerSelect from "./SideBarCustomerSelect";
import { useAuth } from "@/auth/AuthContext";
import { NavUser } from "./nav-user";

export function AppSidebar() {
  const { role } = useAuth();

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader>
        <div className="px-2 py-2 flex flex-row items-center gap-2">
          <img src="/favicon.svg" alt="Logo" className="h-10 w-10" />
          <div>
            <div className="text-lg font-semibold">AxiLANswer</div>
            <div className="text-xs text-muted-foreground">Network topology</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <NavLink to="/dashboard">
                  {({ isActive }) => (
                    <SidebarMenuButton isActive={isActive}>
                      <LayoutDashboard />
                      Dashboard
                    </SidebarMenuButton>
                  )}
                </NavLink>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <NavLink to="/graph">
                  {({ isActive }) => (
                    <SidebarMenuButton isActive={isActive}>
                      <Network />
                      Graph
                    </SidebarMenuButton>
                  )}
                </NavLink>
              </SidebarMenuItem>
              {role === "Admin" && (
                <SidebarMenuItem>
                  <SidebarCustomerSelect />
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

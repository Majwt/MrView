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
import SidebarCustomerSelect from "./sidebar-customer-select";
import { useAuth } from "@/auth/AuthContext";
import { NavUser } from "@/components/nav-user";

export function AppSidebar() {
  const { role } = useAuth();

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader>
        <div className="surface-glass px-2 py-2 flex flex-row items-center gap-2 rounded-lg border border-sidebar-border/60">
          <img src="/favicon.svg" alt="Logo" className="h-10 w-10 rounded-md" />
          <div>
            <div className="font-heading text-lg font-semibold tracking-wide">AxiLANswer</div>
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
                    <SidebarMenuButton
                      isActive={isActive}
                      className="data-[active=true]:bg-primary/12 data-[active=true]:text-primary"
                    >
                      <LayoutDashboard />
                      Dashboard
                    </SidebarMenuButton>
                  )}
                </NavLink>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <NavLink to="/graph">
                  {({ isActive }) => (
                    <SidebarMenuButton
                      isActive={isActive}
                      className="data-[active=true]:bg-primary/12 data-[active=true]:text-primary"
                    >
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

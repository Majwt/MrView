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
import { NavLink, useLocation, useParams } from "react-router";
import SidebarCustomerSelect from "./sidebar-customer-select";
import { NavUser } from "@/components/nav-user";

export function AppSidebar() {
  const { customerId } = useParams();
  const location = useLocation();
  const dashboardPath = customerId ? `/customer/${customerId}/dashboard` : "/dashboard";
  const graphPath = customerId ? `/customer/${customerId}/graph` : "/graph";

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader>
        <SidebarCustomerSelect />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === "/" || location.pathname === dashboardPath}
                  className="data-[active=true]:bg-primary/12 data-[active=true]:text-primary"
                >
                  <NavLink to={dashboardPath}>
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === graphPath}
                  className="data-[active=true]:bg-primary/12 data-[active=true]:text-primary"
                >
                  <NavLink to={graphPath}>
                    <Network />
                    <span>Graph</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
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

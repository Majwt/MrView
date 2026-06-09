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
import { NavLink } from "react-router";
import { useNavigate } from "react-router";
import { Command, CommandEmpty, CommandInput, CommandList } from "./ui/command";
import { useEffect, useState } from "react";
import SidebarCustomerSelect from "./SideBarCustomerSelect";

// YYYY-MM-DDTHH:mm:ssZ+-HH:mm

const version = () => {
  const git = import.meta.env.VITE_GIT_INFO;
  const environment = import.meta.env.MODE;
  const dirty = git.dirty ? "-dirty" : "clean";

  if (environment === "development") {
    return `dev ${git.branch}@${git.commit}${dirty}`;
  }
  return "v" + import.meta.env.VITE_APP_VERSION || `v unknown (${git.commit}${dirty})`;
}

export type sidebarLink = {
  title: string;
  icon: React.ComponentType;
  active?: boolean;
  onClick?: () => void;
  page: string;
};

export type sidebarSection = {
  title: string;
  content: sidebarLink[];
}


export function AppSidebar() {




  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-2 flex flex-row items-center gap-2">
          <img src="/favicon.svg" alt="Logo" className="h-10 w-10" />
          <div>
            <div className="text-lg font-semibold">
              AxiLANswer
            </div>
            <div className="text-xs text-muted-foreground">Network topology</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Home</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <NavLink to="/graph">
                  {({ isActive }) => (

                    <SidebarMenuButton isActive={isActive}>
                      <Network />
                      Complete Graph
                    </SidebarMenuButton>

                  )}
                </NavLink>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarCustomerSelect />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>


        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-row items-center gap-2 px-2 py-2">
          <div className="px-2 py-2 text-xs text-muted-foreground">{version()}</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// src/components/AppSidebar.tsx

import { HeartPulse, Network, Settings, Users } from "lucide-react";

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
import { useEffect, useState, type ReactElement } from "react";
import SidebarCustomerSelect from "./SideBarCustomerSelect";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "./ui/item";
import { Button } from "./ui/button";
import { fetchStatus } from "@/api/status-api";

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

const StatusColors = {
  "Healthy": "green-500",
  "Degraded": "yellow-500",
  "Down": "red-500"
}

export type Status = "Healthy" | "Degraded" | "Down";

const StatusIndicator = ({ status, size = 2 }: { status: Status; size?: number }) => {

  const color = StatusColors[status] ?? "green-500" //StatusColors[status];

  return (
    <div className={`relative flex h-2 w-2`}>
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full bg-${color} opacity-75`}></span>
      <span className={`relative inline-flex h-${size} w-${size} rounded-full bg-${color}`}></span>
    </div>

  )

}

const StatusBadge = ({ status, children }: { status: Status, children: ReactElement }) => {


  return (
    <div className="p-1 flex flex-row justify-items-start items-center gap-2 ">
      <StatusIndicator status={status} />
      <div className="flex flex-row justify-items-center gap-2 items-center ">
        {children}
      </div>
    </div>
  );
}

const REFRESH_INTERVAL_MS = 30 * 1000; // 30 seconds

const AppInfo = () => {

  const [serverStatus, setServerStatus] = useState<Status>("Degraded");

  useEffect(() => {

    const intervalId = window.setInterval(async () => {
      try {
        const status = (await fetchStatus())
        setServerStatus(status);
      } catch  {
        setServerStatus("Down");
      }
    }, REFRESH_INTERVAL_MS);

    return () => { window.clearInterval(intervalId) };
  }, []);


  useEffect(() => {

    fetchStatus()
      .then((data) => {
        setServerStatus(data);
      })
      .catch((error) => {
        console.error("Failed to fetch server status:", error);
      })


  }, [])

  const total_nodes = 12345;

  return (
    <div className="px-2 py-2 items-center gap-2 border-2 rounded-md  bg-popover text-popover-foreground">
      <Item >
        <ItemContent>
          <ItemTitle>Status</ItemTitle>

          <StatusBadge status={serverStatus}>
            <>
              <span className="text-muted-foreground">DB Conn</span>
              <span className={`text-${StatusColors[serverStatus]}`}>{serverStatus}</span>
            </>
          </StatusBadge>
          {/* <h6 className="text-xs text-muted-foreground">Total Nodes</h6> */}
          <StatusBadge status="Healthy">
            <span className="text-muted-foreground font-mono">{total_nodes}</span>
          </StatusBadge>
        </ItemContent>
      </Item>
      <div className="flex flex-row items-center gap-2 px-2 py-2">
        <div className="px-2 py-2 text-xs text-muted-foreground">{version()}</div>
      </div>

    </div>
  )
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
        <AppInfo />
      </SidebarFooter>
    </Sidebar>
  );
}

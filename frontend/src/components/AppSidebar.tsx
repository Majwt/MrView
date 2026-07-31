// src/components/AppSidebar.tsx

import {  LogOut, Network  } from "lucide-react";

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
import { NavLink, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import SidebarCustomerSelect from "./SideBarCustomerSelect";
import { Item, ItemContent, ItemTitle } from "./ui/item";
import { fetchStatus } from "@/api/status-api";
import { useAuth } from "@/auth/AuthContext";
import { useGraphStats } from "@/features/graph/GraphStatsContext";

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

export type Status = "Healthy" | "Degraded" | "Down";

const statusDotClass = (status: Status) => {
  if (status === "Healthy") return "bg-emerald-500";
  if (status === "Degraded") return "bg-amber-500";
  return "bg-rose-500";
};

const statusTextClass = (status: Status) => {
  if (status === "Healthy") return "text-emerald-600";
  if (status === "Degraded") return "text-amber-600";
  return "text-rose-600";
};

const statusBadgeClass = (status: Status) => {
  if (status === "Healthy") return "border-emerald-500/30 bg-emerald-500/10";
  if (status === "Degraded") return "border-amber-500/30 bg-amber-500/10";
  return "border-rose-500/30 bg-rose-500/10";
};

const StatusIndicator = ({ status, size = 2 }: { status: Status; size?: number }) => {
  const dotColor = statusDotClass(status);
  const dotSize = size === 3 ? "h-3 w-3" : "h-2.5 w-2.5";

  return (
    <div className={`relative flex ${dotSize}`}>
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor} opacity-60`}></span>
      <span className={`relative inline-flex ${dotSize} rounded-full ${dotColor}`}></span>
    </div>

  )

}

const StatusBadge = ({ status }: { status: Status }) => {
  return (
    <div className={`p-2 flex flex-row justify-between items-center gap-2 rounded-md border ${statusBadgeClass(status)}`}>
      <div className="flex flex-row items-center gap-2">
        <StatusIndicator status={status} size={3} />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">App Status</span>
      </div>
      <span className={`text-sm font-semibold ${statusTextClass(status)}`}>{status}</span>
    </div>
  );
}

const REFRESH_INTERVAL_MS = 30 * 1000; // 30 seconds

function formatDebugTime(date: Date, utc: boolean) {
  return date.toLocaleString("sv-SE", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    ...(utc ? { timeZone: "UTC" } : {}),
  });
}

const DebugTimes = () => {
  const [now, setNow] = useState(() => new Date());
  const { lastConnectionUtc } = useGraphStats();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const lastConn = lastConnectionUtc ? new Date(lastConnectionUtc) : null;

  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-2 text-[10px] font-mono">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div className="px-2 py-1 border-t mt-1 space-y-0.5">
      {row("UTC now", formatDebugTime(now, true))}
      {row("Local now", formatDebugTime(now, false))}
      {row("Last conn UTC", lastConn ? formatDebugTime(lastConn, true) : "—")}
      {row("Last conn local", lastConn ? formatDebugTime(lastConn, false) : "—")}
    </div>
  );
};

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

  return (
    <div className="px-2 py-2 items-center gap-2 border-2 rounded-md  bg-popover text-popover-foreground">
      <Item >
        <ItemContent>
          <ItemTitle>Status</ItemTitle>

          <StatusBadge status={serverStatus} />
        </ItemContent>
      </Item>
      <DebugTimes />
      <div className="flex flex-row items-center gap-2 px-2 py-2">
        <div className="px-2 py-2 text-xs text-muted-foreground">{version()}</div>
      </div>

    </div>
  )
}

export function AppSidebar() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

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
        <AppInfo />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut />
              Sign out
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

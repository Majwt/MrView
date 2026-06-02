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

type sidebarLink = {
  title: string;
  icon: React.ComponentType;
  active?: boolean;
  onClick?: () => void;
};

type sidebarSection = {
  title: string;
  content: sidebarLink[];
}


const sections: sidebarSection[] = [
  {
    title: "Graphs",
    content: [
      {
        title: "Complete Graph",
        icon: Network,
        active: true,
        onClick: () => {
          alert("Complete Graph clicked");
        }
      },
      {
        title: "Customer Graphs",
        icon: Users,
        onClick: () => {
        }
      },
    ],
  },
  {
    title: "Other things",
    content: [
      {
        title: "Settings",
        icon: Settings,
      }
    ],
  }
];


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
        {sections.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.content.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton isActive={item.active} onClick={item.onClick}>
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-row items-center gap-2 px-2 py-2">
          <div className="px-2 py-2 text-xs text-muted-foreground">{version()}</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { EllipsisVerticalIcon, LogOutIcon } from "lucide-react"
import { useAuth } from "@/auth/AuthContext"
import { useGraphStats } from "@/features/graph/graph-stats-context"
import { useNavigate } from "react-router"

function initials(name: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export function NavUser() {
  const { name, email, picture, role, logout } = useAuth()
  const { lastConnectionUtc } = useGraphStats()
  const navigate = useNavigate()
  const { isMobile } = useSidebar()
  const appVersion = import.meta.env.VITE_APP_VERSION ?? "dev"
  const lastFetchText = lastConnectionUtc
    ? new Date(lastConnectionUtc).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No data yet"

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {picture && <AvatarImage src={picture} alt={name ?? "User"} />}
                <AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-sm leading-tight">
                {role && <span className="truncate text-xs text-muted-foreground">{role}</span>}
                <span className="truncate font-medium">{name ?? "User"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {email ?? ""}
                </span>
              </div>
              <EllipsisVerticalIcon className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {picture && <AvatarImage src={picture} alt={name ?? "User"} />}
                  <AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-start text-sm leading-tight">
                  {role && <span className="truncate text-xs text-muted-foreground">{role}</span>}
                  <span className="truncate font-medium">{name ?? "User"}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {email ?? ""}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <SidebarMenuItem className="mt-2 border-t border-sidebar-border/60 px-2 pt-2">
        <div className="space-y-0.5 text-[11px] text-muted-foreground">
          <p>
            Version: <span className="font-mono">{appVersion}</span>
          </p>
          <p>
            Last fetch: <span className="font-medium">{lastFetchText}</span>
          </p>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

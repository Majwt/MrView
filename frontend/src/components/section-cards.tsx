"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Activity,
  ArrowUpRight,
  Gauge,
  Network,
  Sparkles,
} from "lucide-react"
import type { DashboardStats } from "@/api/dashboard-api"

function fmt(value: number | undefined, loading: boolean): string {
  if (loading || value === undefined) return "—"
  return value.toLocaleString()
}

export function SectionCards({ stats, loading }: { stats: DashboardStats | null; loading?: boolean }) {
  const items = [
    {
      label: "Distinct Connections",
      value: fmt(stats?.total_edges, !!loading),
      hint: "Unique source to destination paths",
      detail: "Deduplicated edges",
      icon: Network,
    },
    {
      label: "Active Nodes",
      value: fmt(stats?.active_nodes, !!loading),
      hint: "Monitored endpoints",
      detail: "Seen in the last 7 days",
      icon: Gauge,
    },
    {
      label: "Total Seen Events",
      value: fmt(stats?.total_seen_count, !!loading),
      hint: "Cumulative traffic reports",
      detail: "Across all active edges",
      icon: Activity,
    },
    {
      label: "New This Week",
      value: fmt(stats?.new_edges_last7_days, !!loading),
      hint: "First observed in the last 7 days",
      detail: "Emerging connections",
      icon: Sparkles,
    },
  ] as const

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.label} className="surface-glass @container/card overflow-hidden border-border/70">
            <CardHeader className="relative">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
              <div className="mb-3 flex items-center justify-between">
                <Badge variant="outline" className="border-primary/20 bg-primary/8 text-primary">
                  <Icon className="mr-1 h-3.5 w-3.5" />
                  Metric
                </Badge>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {item.value}
              </CardTitle>
            </CardHeader>
            <CardFooter className="flex flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                {item.hint}
              </div>
              <div className="text-muted-foreground">{item.detail}</div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}


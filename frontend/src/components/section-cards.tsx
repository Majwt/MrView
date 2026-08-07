"use client"
import { IconTrendingDown, IconTrendingUp, IconArrowNarrowRight} from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { DashboardMetrics } from "@/features/dashboard/api/dashboard-api"



function fmt(value: any | undefined, loading: boolean): string {
  if (loading || value === undefined) return "—"
  return value.toLocaleString()
}

function fmtPercent(value: number | null | undefined, loading: boolean): string {
  if (loading || value == null) return "—"
  const rounded = Math.round(value)
  if (rounded > 0) return `+${rounded}%`
  if (rounded < 0) return `-${rounded}%`
  return `${rounded}%`
}

function fmtComparison(value: number | null | undefined, loading: boolean): string {
  if (loading) return "Comparing value: —"
  if (value == null) return "Comparing value: unavailable"
  return `Comparing value: ${value.toLocaleString()}`
}

export function SectionCards({ stats, loading }: { stats: DashboardMetrics | null; loading?: boolean }) {
  const items = [
    {
      id: "distinct_edges",
      label: fmt(stats?.distinct_edges.name, !!loading),
      value: fmt(stats?.distinct_edges.value, !!loading),
      percentage: fmtPercent(stats?.distinct_edges.percentage_change, !!loading),
      comparison: fmtComparison(stats?.distinct_edges.previous_value, !!loading),
      hint: stats?.distinct_edges.description_header ?? "Unique source to destination paths",
      detail: stats?.distinct_edges.description_body ?? "Deduplicated edges",
    },
    {
      id: "active_nodes",
      label: fmt(stats?.active_nodes.name, !!loading),
      value: fmt(stats?.active_nodes.value, !!loading),
      percentage: fmtPercent(stats?.active_nodes.percentage_change, !!loading),
      comparison: fmtComparison(stats?.active_nodes.previous_value, !!loading),
      hint: stats?.active_nodes.description_header ?? "Monitored endpoints",
      detail: stats?.active_nodes.description_body ?? "Seen in the last 7 days",
    },
    {
      id: "total_events",
      label: fmt(stats?.total_events.name, !!loading),
      value: fmt(stats?.total_events.value, !!loading),
      percentage: fmtPercent(stats?.total_events.percentage_change, !!loading),
      comparison: fmtComparison(stats?.total_events.previous_value, !!loading),
      hint: stats?.total_events.description_header ?? "Cumulative traffic reports",
      detail: stats?.total_events.description_body ?? "Across all active edges",
    },
    {
      id: "new_connections",
      label: fmt(stats?.new_connections.name, !!loading),
      value: fmt(stats?.new_connections.value, !!loading),
      percentage: fmtPercent(stats?.new_connections.percentage_change, !!loading),
      comparison: fmtComparison(stats?.new_connections.previous_value, !!loading),
      hint: stats?.new_connections.description_header ?? "First observed in the last 7 days",
      detail: stats?.new_connections.description_body ?? "Emerging connections",
    },
  ] as const

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {items.map((item) => {
        const isNeutral = item.percentage === "—" || item.percentage === "0%"
        const isNegative = item.percentage.startsWith("-")
        const badgeClass = isNeutral ? "" : isNegative
            ? "border-rose-300/60 bg-rose-100/70 text-rose-700"
            : "border-emerald-300/60 bg-emerald-100/80 text-emerald-700"

        return (
          <Card key={item.id} className="surface-glass @container/card overflow-hidden border-border/70">
            <CardHeader className="relative">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {item.value}
              </CardTitle>
              <CardAction>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex cursor-help rounded-4xl" aria-label={item.comparison}>
                      <Badge variant="outline" className={`pointer-events-none ${badgeClass}`}>
                        {isNeutral
                          ? <IconArrowNarrowRight />
                          : isNegative
                            ? <IconTrendingDown />
                            : <IconTrendingUp />}
                        {item.percentage}
                      </Badge>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    {item.comparison}
                  </TooltipContent>
                </Tooltip>
              </CardAction>
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


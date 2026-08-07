"use client"
import { IconTrendingDown, IconTrendingUp, IconArrowNarrowRight} from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { DashboardCardMetric } from "@/features/dashboard/api/dashboard-api"

function fmt(value: unknown | undefined, loading: boolean): string {
  if (loading || value === undefined) return "—"
  if (typeof value === "number") return value.toLocaleString()
  return String(value)
}

function fmtPercent(value: number | null | undefined, loading: boolean): string {
  if (loading || value == null) return "—"
  const rounded = Math.round(value)
  if (rounded > 0) return `+${rounded}%`
  if (rounded < 0) return `-${Math.abs(rounded)}%`
  return `${rounded}%`
}

function fmtComparison(value: number | null | undefined, loading: boolean): string {
  if (loading) return "Comparing value: —"
  if (value == null) return "Comparing value: unavailable"
  return `Comparing value: ${value.toLocaleString()}`
}

type SectionCardsProps = {
  cards: DashboardCardMetric[]
  loading?: boolean
}

type SkeletonCardItem = { id: string }
type MetricCardItem = {
  id: string
  label: string
  value: string
  percentage: string
  comparison: string
  hint: string
  detail: string
}

function buildCardViewModel(item: DashboardCardMetric): MetricCardItem {
  return {
    id: item.id,
    label: fmt(item.name, false),
    value: fmt(item.value, false),
    percentage: fmtPercent(item.percentage_change, false),
    comparison: fmtComparison(item.previous_value, false),
    hint: item.description_header,
    detail: item.description_body,
  }
}

export function SectionCards({ cards, loading }: SectionCardsProps) {
  const showSkeletons = !!loading && cards.length === 0
  const items: Array<SkeletonCardItem | MetricCardItem> = showSkeletons
    ? Array.from({ length: 4 }, (_, index) => ({ id: `skeleton-${index + 1}` }))
    : cards.map((card) => buildCardViewModel(card))

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {items.map((item) => {
        if (!("label" in item)) {
          return (
            <Card key={item.id} className="surface-glass @container/card min-h-44 overflow-hidden border-border/70">
              <CardHeader className="relative">
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-9 w-28" />
                <CardAction>
                  <Skeleton className="h-5 w-16 rounded-4xl" />
                </CardAction>
              </CardHeader>
              <CardFooter className="flex min-h-14 grow flex-col items-start gap-1.5 text-sm">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </CardFooter>
            </Card>
          )
        }

        const isNeutral = item.percentage === "—" || item.percentage === "0%"
        const isNegative = item.percentage.startsWith("-")
        const badgeClass = isNeutral ? "" : isNegative
            ? "border-rose-300/60 bg-rose-100/70 text-rose-700"
            : "border-emerald-300/60 bg-emerald-100/80 text-emerald-700"

        return (
          <Card key={item.id} className="surface-glass @container/card min-h-44 overflow-hidden border-border/70">
            <CardHeader className="relative">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
              <CardDescription className="line-clamp-1">{item.label}</CardDescription>
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
            <CardFooter className="flex min-h-14 grow flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                {item.hint}
              </div>
              <div className="line-clamp-2 text-muted-foreground">{item.detail}</div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}


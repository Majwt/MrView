"use client"

import * as React from "react"
import {
  type ColumnDef,
  type FilterFn,
  type SortingFn,
} from "@tanstack/react-table"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable as SharedDataTable } from "@/components/data-table"
import NodeDetailsPanel from "@/components/node-details-panel"
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { fetchNodeDetails } from "@/api/graph-api"
import type { NodeRow } from "@/features/dashboard/api/dashboard-api"
import type { GraphNode } from "@/features/graph/types"

export const schema = z.object({
  ciid: z.string(),
  fqdn: z.string(),
  hostname: z.string(),
  distinct_edges: z.number(),
  connection_count: z.number(),
  first_seen: z.string(),
  last_seen: z.string(),
  group_name: z.string(),
})

const columns: ColumnDef<NodeRow>[] = [
  {
    accessorKey: "fqdn",
    header: "FQDN",
    cell: ({ row }) => <TableCellViewer item={row.original} />,
    enableHiding: false,
  },
  {
    accessorKey: "os",
    header: "Operating System",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.os}</span>
    ),
  },
  {
    accessorKey: "client",
    header: "Client",
    cell: ({ row }) => (
      row.original.client === "unknown" ? (
        <span className="font-mono text-sm text-muted-foreground">-</span>
      ) : (
        <span className="font-mono text-sm">{row.original.client}</span>
      )
    ),
  },
  {
    accessorKey: "client_version",
    header: "Version",
    sortingFn: semverSortingFn,
    cell: ({ row }) => (
      row.original.client.toLowerCase() === "unknown" ? (
        <span className="font-mono text-sm text-muted-foreground">-</span>
      ) : (
        <span className="font-mono text-sm">{row.original.client_version}</span>
      )
    ),
  },
  {
    accessorKey: "group_name",
    header: "Customer",
    cell: ({ row }) =>
      row.original.group_name ? (
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {row.original.group_name}
        </Badge>
      ) : null,
  },
  {
    accessorKey: "distinct_edges",
    header: () => <div className="w-full text-end">Edges</div>,
    cell: ({ row }) => (
      <div className="text-end tabular-nums">{row.original.distinct_edges.toLocaleString()}</div>
    ),
  },
  {
    accessorKey: "connection_count",
    header: () => <div className="w-full text-end">Connections</div>,
    cell: ({ row }) => (
      <div className="text-end tabular-nums font-semibold">{row.original.connection_count.toLocaleString()}</div>
    ),
  },
  {
    accessorKey: "last_seen",
    header: "Last Seen",
    cell: ({ row }) => {
      const d = new Date(row.original.last_seen)
      return (
        <span className="text-muted-foreground text-sm">
          {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      )
    },
  },
  {
    accessorKey: "first_seen",
    header: "First Seen",
    cell: ({ row }) => {
      const d = new Date(row.original.first_seen)
      return (
        <span className="text-muted-foreground text-sm">
          {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      )
    },
  },
]

type ParsedSemver = {
  main: number[]
  pre: Array<number | string> | null
}

function parseSemver(value: string | null | undefined): ParsedSemver | null {
  if (!value) return null

  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed === "unknown" || trimmed === "-") return null

  const normalized = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed
  const [mainPart, prePart] = normalized.split("-", 2)
  const mainTokens = mainPart.split(".")

  if (!mainTokens.every((token) => /^\d+$/.test(token))) {
    return null
  }

  const main = mainTokens.map((token) => Number(token))
  const pre = prePart
    ? prePart
      .split(".")
      .map((token) => (/^\d+$/.test(token) ? Number(token) : token))
    : null

  return { main, pre }
}

function compareSemver(a: ParsedSemver, b: ParsedSemver): number {
  const maxLength = Math.max(a.main.length, b.main.length)
  for (let i = 0; i < maxLength; i += 1) {
    const av = a.main[i] ?? 0
    const bv = b.main[i] ?? 0
    if (av !== bv) return av - bv
  }

  if (a.pre === null && b.pre === null) return 0
  if (a.pre === null) return 1
  if (b.pre === null) return -1

  const maxPreLength = Math.max(a.pre.length, b.pre.length)
  for (let i = 0; i < maxPreLength; i += 1) {
    const av = a.pre[i]
    const bv = b.pre[i]

    if (av === undefined) return -1
    if (bv === undefined) return 1

    const avIsNumber = typeof av === "number"
    const bvIsNumber = typeof bv === "number"

    if (avIsNumber && bvIsNumber && av !== bv) {
      return av - bv
    }
    if (avIsNumber !== bvIsNumber) {
      return avIsNumber ? -1 : 1
    }
    if (av !== bv) {
      return String(av).localeCompare(String(bv))
    }
  }

  return 0
}

function semverSortingFn(rowA: Parameters<SortingFn<NodeRow>>[0], rowB: Parameters<SortingFn<NodeRow>>[1], columnId: Parameters<SortingFn<NodeRow>>[2]) {
  const rawA = String(rowA.getValue(columnId) ?? "")
  const rawB = String(rowB.getValue(columnId) ?? "")

  const parsedA = parseSemver(rawA)
  const parsedB = parseSemver(rawB)

  if (parsedA && parsedB) {
    return compareSemver(parsedA, parsedB)
  }

  if (parsedA) return 1
  if (parsedB) return -1

  return rawA.localeCompare(rawB, undefined, { numeric: true, sensitivity: "base" })
}

const nodeGlobalFilter: FilterFn<NodeRow> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? "").trim().toLowerCase()
  if (!q) return true

  const item = row.original
  const firstSeen = new Date(item.first_seen)
  const lastSeen = new Date(item.last_seen)
  const firstSeenLabel = Number.isNaN(firstSeen.getTime())
    ? ""
    : firstSeen.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  const lastSeenLabel = Number.isNaN(lastSeen.getTime())
    ? ""
    : lastSeen.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

  const searchText = [
    item.fqdn,
    item.os,
    item.client,
    item.client_version,
    item.group_name,
    String(item.distinct_edges),
    item.distinct_edges.toLocaleString(),
    String(item.connection_count),
    item.connection_count.toLocaleString(),
    item.first_seen,
    item.last_seen,
    firstSeenLabel,
    lastSeenLabel,
  ].join(" ").toLowerCase()

  return searchText.includes(q)
}

export function DataTable({ data }: { data: NodeRow[] }) {
  const [globalFilter, setGlobalFilter] = React.useState("")

  return (
    <SharedDataTable
      columns={columns}
      data={data}
      globalFilter={globalFilter}
      onGlobalFilterChange={setGlobalFilter}
      globalFilterFn={nodeGlobalFilter}
      toolbar={
        <Input
          placeholder="Search nodes…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="h-8 w-48 lg:w-64"
        />
      }
      getRowId={(row) => row.ciid}
      initialSorting={[{ id: "connection_count", desc: true }]}
      enablePagination
      initialPageSize={25}
      paginationItemLabel="node(s)"
    />
  )
}

function TableCellViewer({ item }: { item: NodeRow }) {
  const [open, setOpen] = React.useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = React.useState(false)
  const [details, setDetails] = React.useState<Partial<GraphNode> | null>(null)

  React.useEffect(() => {
    if (!open || details) {
      return
    }

    let cancelled = false
    setIsLoadingDetails(true)

    fetchNodeDetails(item.ciid)
      .then((nextDetails) => {
        if (!cancelled) {
          setDetails(nextDetails)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetails(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, details, item.ciid])

  const nodeData: GraphNode = {
    id: item.ciid,
    fqdn: item.fqdn,
    hostname: item.hostname,
    ciid: item.ciid,
    distinct_edge: item.distinct_edges,
    connection_count: item.connection_count,
    first_seen: item.first_seen,
    last_seen: item.last_seen,
    is_placeholder: false,
    x: 0, y: 0, fx: null, fy: null,
    ...(details ?? {}),
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button variant="link" className="h-auto p-0 font-mono text-sm">
          {item.fqdn}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-[27.5rem] flex flex-col min-h-0">
        <NodeDetailsPanel
          node={nodeData}
          isLoadingDetails={isLoadingDetails}
          onBack={() => setOpen(false)}
        />
      </DrawerContent>
    </Drawer>
  )
}

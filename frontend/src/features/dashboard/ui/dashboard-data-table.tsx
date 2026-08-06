"use client"

import * as React from "react"
import {
  type ColumnDef,
  type FilterFn,
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

const nodeRowFilter: FilterFn<NodeRow> = (row, _colId, filterValue) => {
  const q = String(filterValue ?? "").toLowerCase()
  if (!q) return true
  const { fqdn, hostname, group_name } = row.original
  return [fqdn, hostname, group_name].some((v) => (v ?? "").toLowerCase().includes(q))
}

const columns: ColumnDef<NodeRow>[] = [
  {
    accessorKey: "fqdn",
    header: "FQDN",
    cell: ({ row }) => <TableCellViewer item={row.original} />,
    enableHiding: false,
    filterFn: nodeRowFilter,
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
        <span className="font-mono text-sm">{row.original.client} {row.original.client_version}</span>
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

export function DataTable({ data }: { data: NodeRow[] }) {
  const [globalFilter, setGlobalFilter] = React.useState("")
  const columnFilters = React.useMemo(
    () => [{ id: "fqdn", value: globalFilter }],
    [globalFilter],
  )

  return (
    <SharedDataTable
      columns={columns}
      data={data}
      globalFilter={globalFilter}
      onGlobalFilterChange={setGlobalFilter}
      columnFilters={columnFilters}
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

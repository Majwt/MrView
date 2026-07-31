"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { z } from "zod"

import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Columns3Icon, ChevronDownIcon } from "lucide-react"
import type { NodeRow } from "@/api/dashboard-api"

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
    accessorKey: "hostname",
    header: "Hostname",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.hostname}</span>
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
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "connection_count", desc: true }])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnFilters },
    getRowId: (row) => row.ciid,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return (
    <div className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 pb-4 lg:px-6">
        <Input
          placeholder="Filter by FQDN…"
          value={(table.getColumn("fqdn")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("fqdn")?.setFilterValue(e.target.value)}
          className="h-8 w-48 lg:w-64"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3Icon data-icon="inline-start" />
              Columns
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {table
              .getAllColumns()
              .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="text-sm text-muted-foreground px-4">
          {table.getFilteredRowModel().rows.length} node(s)
        </div>
      </div>
    </div>
  )
}

function TableCellViewer({ item }: { item: NodeRow }) {
  const isMobile = useIsMobile()
  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="h-auto p-0 font-mono text-sm">
          {item.fqdn}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Node Detail</DrawerTitle>
          <DrawerDescription className="font-mono text-xs break-all">{item.ciid}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-4 py-2 text-sm">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <span className="text-muted-foreground">FQDN</span>
            <span className="font-mono">{item.fqdn}</span>
            <span className="text-muted-foreground">Hostname</span>
            <span className="font-mono">{item.hostname}</span>
            <span className="text-muted-foreground">Customer</span>
            <span>{item.group_name || "—"}</span>
            <span className="text-muted-foreground">Distinct edges</span>
            <span className="tabular-nums">{item.distinct_edges.toLocaleString()}</span>
            <span className="text-muted-foreground">Connections</span>
            <span className="tabular-nums">{item.connection_count.toLocaleString()}</span>
            <span className="text-muted-foreground">First seen</span>
            <span>{new Date(item.first_seen).toLocaleString()}</span>
            <span className="text-muted-foreground">Last seen</span>
            <span>{new Date(item.last_seen).toLocaleString()}</span>
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

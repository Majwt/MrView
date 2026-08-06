"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
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
import NodeDetailsPanel from "@/features/graph/ui/node-details-panel"
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
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "connection_count", desc: true }])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })

  const columnFilters = React.useMemo(
    () => [{ id: "fqdn", value: globalFilter }],
    [globalFilter],
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnFilters, pagination },
    getRowId: (row) => row.ciid,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  React.useEffect(() => {
    table.setPageIndex(0)
  }, [globalFilter, table])

  const filteredCount = table.getFilteredRowModel().rows.length
  const pageStart = filteredCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const pageEnd = Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredCount)

  return (
    <div className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between  pb-4 ">
        <Input
          placeholder="Search nodes…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
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
      <div className="relative flex flex-col gap-4 overflow-auto">
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
        <div className="flex flex-col gap-3 px-4 pb-1 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>
            Showing {pageStart}-{pageEnd} of {filteredCount} node(s)
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-xs uppercase tracking-wide text-muted-foreground">
              Rows
            </label>
            <select
              id="page-size"
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <span className="min-w-20 text-center text-xs">
              Page {pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TableCellViewer({ item }: { item: NodeRow }) {
  const [open, setOpen] = React.useState(false)

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
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button variant="link" className="h-auto p-0 font-mono text-sm">
          {item.fqdn}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-[27.5rem] flex flex-col min-h-0">
        <NodeDetailsPanel node={nodeData} onBack={() => setOpen(false)} />
      </DrawerContent>
    </Drawer>
  )
}

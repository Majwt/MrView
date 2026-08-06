import type React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useState } from "react";

import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Columns3Icon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  initialColumnVisibility?: VisibilityState;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  toolbar?: React.ReactNode;
  getRowHoverId?: (row: TData) => string | null;
  hoveredRowId?: string | null;
  hoveredRowIds?: Set<string>;
  onRowHoverChange?: (rowId: string | null) => void;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  loading,
  initialColumnVisibility,
  globalFilter: controlledGlobalFilter,
  onGlobalFilterChange: setControlledGlobalFilter,
  toolbar,
  getRowHoverId,
  hoveredRowId,
  hoveredRowIds,
  onRowHoverChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => initialColumnVisibility ?? {},
  );
  const [uncontrolledGlobalFilter, setUncontrolledGlobalFilter] = useState("");
  const globalFilter = controlledGlobalFilter ?? uncontrolledGlobalFilter;
  const setGlobalFilter = setControlledGlobalFilter ?? setUncontrolledGlobalFilter;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const hidableColumns = table
    .getAllColumns()
    .filter((col) => typeof col.accessorFn !== "undefined" && col.getCanHide());

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(hidableColumns.length > 0 || toolbar) && (
        <div className="flex items-center justify-between gap-2 pb-2">
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          {hidableColumns.length > 0 && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Columns3Icon className="mr-1 size-3" />
                Columns
                <ChevronDownIcon className="ml-1 size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {hidableColumns.map((column) => (
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
          </DropdownMenu>}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <table className="w-full caption-bottom  text-sm">
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "cursor-pointer select-none overflow-hidden text-ellipsis bg-background",
                      header.column.id === "protocol" && "w-16",
                      isPortColumn(header.column.id) && "w-24",
                      isCountColumn(header.column.id) && "w-24",
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}

                    {{
                      asc: " ↑",
                      desc: " ↓",
                    }[header.column.getIsSorted() as string] ?? null}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading && !table.getRowModel().rows.length ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {table.getVisibleLeafColumns().map((col) => (
                    <TableCell key={col.id}>
                      <div
                        className="h-3.5 animate-pulse rounded bg-muted"
                        style={{ width: `${55 + ((i * 7 + col.id.length * 3) % 40)}%` }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const rowHoverId = getRowHoverId?.(row.original) ?? null;
                const isHovered =
                  !!rowHoverId &&
                  (rowHoverId === hoveredRowId || (hoveredRowIds?.has(rowHoverId) ?? false));

                return (
                  <TableRow
                    key={row.id}
                    data-state={isHovered ? "selected" : undefined}
                    onMouseEnter={() => onRowHoverChange?.(rowHoverId)}
                    onMouseLeave={() => onRowHoverChange?.(null)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "overflow-hidden text-ellipsis",
                          cell.column.id === "protocol" && "w-16",
                          isPortColumn(cell.column.id) && "w-20",
                          isCountColumn(cell.column.id) && "w-20",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}


function isPortColumn(columnId: string) {
  return columnId === "sourcePort" || columnId === "targetPort";
}

function isCountColumn(columnId: string) {
  return columnId === "distinct_edges" || columnId === "connections" || columnId === "seenCount";
}

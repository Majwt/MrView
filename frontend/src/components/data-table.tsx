import type React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, Columns3Icon } from "lucide-react";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  initialColumnVisibility?: VisibilityState;
  initialSorting?: SortingState;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  paginationItemLabel?: string;
  emptyMessage?: string;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  columnFilters?: ColumnFiltersState;
  toolbar?: React.ReactNode;
  getRowId?: (originalRow: TData, index: number, parent?: { id: string }) => string;
  enablePagination?: boolean;
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
  initialSorting,
  initialPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  paginationItemLabel = "row(s)",
  emptyMessage = "No results.",
  globalFilter: controlledGlobalFilter,
  onGlobalFilterChange: setControlledGlobalFilter,
  columnFilters,
  toolbar,
  getRowId,
  enablePagination = false,
  getRowHoverId,
  hoveredRowId,
  hoveredRowIds,
  onRowHoverChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => initialColumnVisibility ?? {},
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [uncontrolledGlobalFilter, setUncontrolledGlobalFilter] = useState("");
  const globalFilter = controlledGlobalFilter ?? uncontrolledGlobalFilter;
  const setGlobalFilter = setControlledGlobalFilter ?? setUncontrolledGlobalFilter;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      columnVisibility,
      ...(enablePagination ? { pagination } : {}),
    },
    getRowId,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: enablePagination ? setPagination : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
  });

  useEffect(() => {
    if (enablePagination) {
      table.setPageIndex(0);
    }
  }, [enablePagination, globalFilter, table]);

  const hidableColumns = table
    .getAllColumns()
    .filter((col) => typeof col.accessorFn !== "undefined" && col.getCanHide());

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageStart = filteredCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredCount);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(hidableColumns.length > 0 || toolbar) && (
        <div className="flex items-center justify-between gap-2 pb-2">
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          {hidableColumns.length > 0 && (
            <DropdownMenu>
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
            </DropdownMenu>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  // Keep the sort glyph in the same layout flow as the header content.
                  // Some headers render custom full-width blocks (for right-aligned labels),
                  // and appending raw text after them can force awkward wrapping.
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
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          "inline-flex max-w-full items-center gap-1",
                          isCountColumn(header.column.id) && "ml-auto",
                        )}
                      >
                        <div className="min-w-0">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                        <span className="shrink-0">
                          {{
                            asc: "↑",
                            desc: "↓",
                          }[header.column.getIsSorted() as string] ?? ""}
                        </span>
                      </div>
                    )}
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
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>

      {enablePagination ? (
        <div className="flex flex-col gap-3 px-4 pt-3 pb-1 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>
            Showing {pageStart}-{pageEnd} of {filteredCount} {paginationItemLabel}
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
              {pageSizeOptions.map((size) => (
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
      ) : null}
    </div>
  );
}

function isPortColumn(columnId: string) {
  return columnId === "sourcePort" || columnId === "targetPort";
}

function isCountColumn(columnId: string) {
  return columnId === "distinct_edges" || columnId === "connections" || columnId === "seenCount";
}
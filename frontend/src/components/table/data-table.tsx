import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  getRowHoverId?: (row: TData) => string | null;
  hoveredRowId?: string | null;
  hoveredRowIds?: Set<string>;
  onRowHoverChange?: (rowId: string | null) => void;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  globalFilter: controlledGlobalFilter,
  onGlobalFilterChange: setControlledGlobalFilter,
  getRowHoverId,
  hoveredRowId,
  hoveredRowIds,
  onRowHoverChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [uncontrolledGlobalFilter, setUncontrolledGlobalFilter] = useState("");
  const globalFilter = controlledGlobalFilter ?? uncontrolledGlobalFilter;
  const setGlobalFilter = setControlledGlobalFilter ?? setUncontrolledGlobalFilter;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col ">
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
                      isProtocolColumn(header.column.id) && "w-24",
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
            {table.getRowModel().rows.length ? (
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

function isProtocolColumn(columnId: string) {
  return columnId === "protocol" 
}

function isPortColumn(columnId: string) {
  return columnId === "sourcePort" || columnId === "targetPort";
}

function isCountColumn(columnId: string) {
  return columnId === "distinct_edges" || columnId === "connections" || columnId === "seenCount";
}

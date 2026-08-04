import type { ColumnDef, SortingFn } from "@tanstack/react-table";

import {
  HostCell,
  NumericCell,
  ProcessCell,
  RichDateCell,
  SeenCountCell,
  ServiceCell,
} from "./styled-cells";

export type TableConnection = {
  id: string;
  source: string;
  sourceIp: string;
  sourcePort: number;
  sourceProcess: string;
  target: string;
  targetIp: string;
  targetPort: number;
  targetProcess: string;
  protocol: string;
  serviceName: string;
  seenCount: number;
  firstSeen: string;
  lastSeen: string;
};

const dateSortingFn: SortingFn<TableConnection> = (rowA, rowB, columnId) => {
  return toTimestamp(rowA.getValue(columnId)) - toTimestamp(rowB.getValue(columnId));
};

export function createConnectionColumns(
  onHostFocus?: (fqdn: string) => void,
): ColumnDef<TableConnection>[] {
  return [
  {
    accessorKey: "serviceName",
    header: "Service",
    cell: ({ getValue }) => <ServiceCell value={String(getValue() ?? "")} />,
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <HostCell
        primary={row.original.source}
        secondary={row.original.sourceIp}
        onPrimaryClick={onHostFocus ? () => onHostFocus(row.original.source) : undefined}
      />
    ),
  },
  // {
  //   accessorKey: "sourceIp",
  //   header: "Local IP",
  //   cell: ({ getValue }) => <MonoIdCell value={String(getValue() ?? "")} />,
  // },
  {
    accessorKey: "sourcePort",
    header: "Src Port",
    cell: ({ row }) => (
      <NumericCell
        value={row.original.sourcePort}
        enableCopy
        copyValue={`${row.original.sourcePort}`}
      />
    ),
  },
  {
    accessorKey: "sourceProcess",
    header: "Source proc",
    cell: ({ getValue }) => <ProcessCell value={String(getValue() ?? "")} />,
  },
  {
    id: "direction",
    header: "",
    cell: () => (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[40px] text-muted-foreground">→</span>
      </div>
    ),
  },
  {
    accessorKey: "target",
    header: "Destination",
    cell: ({ row }) => (
      <HostCell
        primary={row.original.target}
        secondary={row.original.targetIp}
        onPrimaryClick={onHostFocus ? () => onHostFocus(row.original.target) : undefined}
      />
    ),
  },
  // {
  //   accessorKey: "targetIp",
  //   header: "Peer IP",
  //   cell: ({ getValue }) => <MonoIdCell value={String(getValue() ?? "")} />,
  // },
  {
    accessorKey: "targetPort",
    header: "Dst Port",
    cell: ({ row }) => (
      <NumericCell
        value={row.original.targetPort}
        enableCopy
        copyValue={`${row.original.targetPort}`}
      />
    ),
  },
  {
    accessorKey: "targetProcess",
    header: "Destination proc",
    cell: ({ getValue }) => <ProcessCell value={String(getValue() ?? "")} />,
  },
  {
    accessorKey: "seenCount",
    header: "# Seen",
    cell: ({ getValue }) => <SeenCountCell value={Number(getValue() ?? 0)} />,
  },
  {
    accessorKey: "lastSeen",
    header: "Last seen",
    sortingFn: dateSortingFn,
    sortDescFirst: true,
    cell: ({ getValue }) => <RichDateCell value={getValue()} />,
  },
  ];
}

export const connectionColumns: ColumnDef<TableConnection>[] = createConnectionColumns();

function toTimestamp(value: unknown) {
  const timestamp = Date.parse(String(value ?? ""));

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

import type { ColumnDef, SortingFn } from "@tanstack/react-table";

import { HostCell, MonoIdCell, NumericCell, RichDateCell } from "./styled-cells";

export type TableNode = {
  id: string;
  hostname: string;
  fqdn: string;
  ipv4: string;
  mac_address: string;
  distinct_edges: number;
  connections: number;
  firstSeen: string;
  lastSeen: string;
};

const dateSortingFn: SortingFn<TableNode> = (rowA, rowB, columnId) => {
  return toTimestamp(rowA.getValue(columnId)) - toTimestamp(rowB.getValue(columnId));
};

export const nodeColumns: ColumnDef<TableNode>[] = [
  {
    accessorKey: "fqdn",
    header: "FQDN",
    cell: ({ row }) => <HostCell primary={row.original.fqdn} secondary={row.original.ipv4} />,
  },
  // {
  //   accessorKey: "ipv4",
  //   header: "IPv4",
  //   cell: ({ getValue }) => <MonoIdCell value={String(getValue() ?? "")} />,
  // },
  {
    accessorKey: "mac_address",
    header: "MAC Address",
    cell: ({ getValue }) => <MonoIdCell value={String(getValue() ?? "")} />,
  },
  {
    accessorKey: "distinct_edges",
    header: "# Edges",
    cell: ({ getValue }) => <NumericCell value={Number(getValue() ?? 0)} />,
  },
  {
    accessorKey: "connections",
    header: "# Conn",
    cell: ({ getValue }) => <NumericCell value={Number(getValue() ?? 0)} emphasize />,
  },
  {
    accessorKey: "lastSeen",
    header: "Last Seen",
    sortingFn: dateSortingFn,
    sortDescFirst: true,
    cell: ({ getValue }) => <RichDateCell value={getValue()} />,
  },
  {
    accessorKey: "firstSeen",
    header: "First Seen",
    sortingFn: dateSortingFn,
    sortDescFirst: true,
    cell: ({ getValue }) => <RichDateCell value={getValue()} />,
  },
];

function toTimestamp(value: unknown) {
  const timestamp = Date.parse(String(value ?? ""));

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

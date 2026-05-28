import type { ColumnDef } from "@tanstack/react-table";

import { DateCell } from "./date-cell";

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

export const nodeColumns: ColumnDef<TableNode>[] = [
  {
    accessorKey: "fqdn",
    header: "FQDN",
  },
  {
    accessorKey: "ipv4",
    header: "IPv4",
  },
  {
    accessorKey: "mac_address",
    header: "MAC Address",
  },
  {
    accessorKey: "distinct_edges",
    header: "# Distinct Edges",
  },
  {
    accessorKey: "connections",
    header: "# Connections",
  },
  {
    accessorKey: "firstSeen",
    header: "First Seen",
    cell: ({ getValue }) => <DateCell value={getValue()} />,
  },
  {
    accessorKey: "lastSeen",
    header: "Last Seen",
    cell: ({ getValue }) => <DateCell value={getValue()} />,
  },
];

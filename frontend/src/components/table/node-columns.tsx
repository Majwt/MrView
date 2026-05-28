import type { ColumnDef } from "@tanstack/react-table";

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
    accessorKey: "hostname",
    header: "Hostname",
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
  },
  {
    accessorKey: "lastSeen",
    header: "Last Seen",
  },
];

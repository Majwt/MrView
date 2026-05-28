import type { ColumnDef } from "@tanstack/react-table";

export type Connection = {
  id: string;

  direction: "Incoming" | "Outgoing" | "Unknown";

  localHost: string;
  localIp: string;

  localService: string;
  localPort: number;
  localProcess: string;

  peerHost: string;
  peerIp: string;

  peerService: string;
  peerPort: number;

  connections: number;

  lastSeen: string;
};

// These are when a node is selected and we want to show all connections related to that node
export const connectionColumns: ColumnDef<Connection>[] = [
  {
    accessorKey: "direction",
    header: "Direction",
  },
  {
    accessorKey: "localService",
    header: "Local Service",
  },
  {
    accessorKey: "localPort",
    header: "Local Port",
  },
  {
    accessorKey: "localProcess",
    header: "Local Process",
  },
  {
    accessorKey: "peerHost",
    header: "Peer Host",
  },
  {
    accessorKey: "peerIp",
    header: "Peer IP",
  },
  {
    accessorKey: "peerService",
    header: "Peer Service",
  },
  {
    accessorKey: "peerPort",
    header: "Peer Port",
  },
  {
    accessorKey: "connections",
    header: "Connections",
  },
  {
    accessorKey: "lastSeen",
    header: "Last Seen",
  },
];

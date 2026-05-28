import type { ColumnDef } from "@tanstack/react-table";

export type TableConnection = {
  id: string;
  source: string;
  sourceIp: string;
  sourcePort: number;
  target: string;
  targetIp: string;
  targetPort: number;
  protocol: string;
  serviceName: string;
  seenCount: number;
  firstSeen: string;
  lastSeen: string;
};

export const connectionColumns: ColumnDef<TableConnection>[] = [
  {
    accessorKey: "source",
    header: "Source",
  },
  {
    accessorKey: "sourceIp",
    header: "Source IP",
  },
  {
    accessorKey: "sourcePort",
    header: "Source port",
  },
  {
    accessorKey: "target",
    header: "Target",
  },
  {
    accessorKey: "targetIp",
    header: "Target IP",
  },
  {
    accessorKey: "targetPort",
    header: "Target port",
  },
  {
    accessorKey: "protocol",
    header: "Protocol",
  },
  {
    accessorKey: "serviceName",
    header: "Service",
  },
  {
    accessorKey: "seenCount",
    header: "Seen count",
  },
  {
    accessorKey: "firstSeen",
    header: "First seen",
  },
  {
    accessorKey: "lastSeen",
    header: "Last seen",
  },
];

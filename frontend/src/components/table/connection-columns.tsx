import type { ColumnDef } from "@tanstack/react-table";

import { DateCell } from "./date-cell";
import { formatTableDate } from "./format-date";

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

export const connectionColumns: ColumnDef<TableConnection>[] = [
  {
    accessorKey: "protocol",
    header: "TCP/UDP",
  },
  {
    accessorKey: "source",
    header: "Local",
  },
  {
    accessorKey: "sourceIp",
    header: "Local IP",
  },
  {
    accessorKey: "sourcePort",
    header: "Local port",
  },
  {
    accessorKey: "sourceProcess",
    header: "Local proc",
  },
  {
    accessorKey: "target",
    header: "Peer",
  },
  {
    accessorKey: "targetIp",
    header: "Peer IP",
  },
  {
    accessorKey: "targetPort",
    header: "Peer port",
  },
  {
    accessorKey: "targetProcess",
    header: "Peer proc",
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
    accessorKey: "lastSeen",
    header: "Last seen",
    cell: ({ row, getValue }) => {
      const firstSeen = formatTableDate(row.original.firstSeen);

      return <DateCell title={`First seen: ${firstSeen}`} value={getValue()} />;
    },
  },
];

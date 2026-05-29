import type { ColumnDef } from "@tanstack/react-table";

import {
  HostCell,
  NumericCell,
  ProcessCell,
  ProtocolCell,
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

export const connectionColumns: ColumnDef<TableConnection>[] = [
  {
    accessorKey: "protocol",
    header: "TCP/UDP",
    cell: ({ getValue }) => <ProtocolCell value={String(getValue() ?? "")} />,
  },
  {
    accessorKey: "serviceName",
    header: "Service",
    cell: ({ getValue }) => <ServiceCell value={String(getValue() ?? "")} />,
  },
  {
    accessorKey: "source",
    header: "Local",
    cell: ({ row }) => <HostCell primary={row.original.source} secondary={row.original.sourceIp} />,
  },
  // {
  //   accessorKey: "sourceIp",
  //   header: "Local IP",
  //   cell: ({ getValue }) => <MonoIdCell value={String(getValue() ?? "")} />,
  // },
  {
    accessorKey: "sourcePort",
    header: "Src Port",
    cell: ({ getValue }) => <NumericCell value={Number(getValue() ?? 0)} />,
  },
  {
    accessorKey: "sourceProcess",
    header: "Local proc",
    cell: ({ getValue }) => <ProcessCell value={String(getValue() ?? "")} />,
  },
  {
    accessorKey: "target",
    header: "Peer",
    cell: ({ row }) => <HostCell primary={row.original.target} secondary={row.original.targetIp} />,
  },
  // {
  //   accessorKey: "targetIp",
  //   header: "Peer IP",
  //   cell: ({ getValue }) => <MonoIdCell value={String(getValue() ?? "")} />,
  // },
  {
    accessorKey: "targetPort",
    header: "Dst Port",
    cell: ({ getValue }) => <NumericCell value={Number(getValue() ?? 0)} />,
  },
  {
    accessorKey: "targetProcess",
    header: "Peer proc",
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
    cell: ({ getValue }) => <RichDateCell value={getValue()} />,
  },
];

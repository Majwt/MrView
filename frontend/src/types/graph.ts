export type GraphNode = {
  fqdn: string;
  ip: string;
};

export type GraphEdge = {
  id: string;
  source_ip: string;
  source_port: number;
  source_fqdn: string;
  source_pid?: number;
  source_process_name?: string;
  target_ip: string;
  target_port: number;
  target_fqdn: string;
  target_pid?: number;
  target_process_name?: string;
  pid?: number;
  process_name?: string;
  seen_count?: number;
  last_seen?: string;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type GraphCursor = {
  last_seen: string;
  last_row_id: number;
};

export type GraphSnapshotResponse = GraphData & {
  cursor: GraphCursor;
};

export type GraphDeltaResponse = {
  upsert_nodes: GraphNode[];
  upsert_edges: GraphEdge[];
  remove_node_ids: string[];
  remove_edge_ids: string[];
  cursor: GraphCursor;
};

export type EdgeDetails = {
  id: string;
  source_fqdn: string;
  source_ip: string;
  target_fqdn: string;
  target_ip: string;
  connections: GraphEdge[];
};

export type NodePortTarget = {
  port: number;
  remote_port: number;
  fqdn: string;
  ip: string;
  direction: "incoming" | "outgoing";
  pid: number;
  processName: string | null;
  seenCount: number;
  lastSeen: string;
};


export type CombinedEdge = {
  id: string;
  source_fqdn: string;
  target_fqdn: string;
  connections: GraphEdge[];
  ports: number[];
  processes: string[];
};


export type NodeDetails = {
  label: string;
  ip: string;
  fqdn: string;
  color: string;
  subnet: string;
  portTargets: NodePortTarget[];
  size: number;
  x: number;
  y: number;
}

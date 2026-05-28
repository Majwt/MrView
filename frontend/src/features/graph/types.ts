export type Customer = {
  name: string;
  cmdb_ci_id: string;
  id: number;
};

export type NetInterface = {
  ip: string;
  mac: string;
  subnet: string;
};
export type GraphNode = {
  id: string;
  fqdn: string;
  hostname: string;
  interfaces: NetInterface[];
  distinct_edge: number;
  connection_count: number;
  customer: Customer;
  first_seen: string;
  last_seen: string;
};

export type GraphEdge = {
  id: string;
  protocol: "UDP" | "TCP";
  service_name: string;

  source_ip: string;
  source_port: number;
  source_fqdn: string;
  source_pid: number | null;
  source_process_name: string | null;

  target_ip: string;
  target_port: number;
  target_fqdn: string;
  target_pid: number | null;
  target_process_name: string | null;

  seen_count: number;
  last_seen: string;
  first_seen: string;
};

export type GraphCursor = {
  last_seen: string;
  last_seen_edge_id: number;
  last_seen_node_id: number;
};

export type GraphSnapshot = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  cursor: GraphCursor;
};

export type GraphDelta = {
  cursor: GraphCursor;
  upsert_nodes: GraphNode[];
  upsert_edges: GraphEdge[];
  remove_node_ids: string[];
  remove_edge_ids: string[];
};

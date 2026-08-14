
import * as d3 from "d3";

export type OpenPort = {
  proto: string | null;
  local_ip: string | null;
  local_port: string | null;
  foreign_ip: string | null;
  foreign_port: string | null;
  pid: number | null;
};

export type Customer = {
  name: string;
  cmdb_ci_id: string;
  id: number;
};

export type NetInterface = {
  adapter: string;
  ipv4: string | null;
  subnetv4: string | null;
  ipv6: string | null;
  subnetv6: string | null;
  mac: string;
  status?: string;
};
export type GraphNode = d3.SimulationNodeDatum & {
  id: string;
  fqdn: string;
  hostname: string;
  ciid?: string;
  os?: string;
  client?: string;
  client_version?: string;
  interfaces?: NetInterface[];
  distinct_edge: number;
  connection_count: number;
  customer?: Customer;
  first_seen?: string;
  last_seen?: string;
  is_placeholder?: boolean;
  x: number;
  y: number;
  fx: number | null;
  fy: number | null;
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
} & d3.SimulationLinkDatum<GraphNode>;

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





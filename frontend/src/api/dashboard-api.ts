import { apiGet } from "@/api/client";

export type DashboardStats = {
  total_edges: number;
  active_nodes: number;
  total_seen_count: number;
  new_edges_last7_days: number;
};

export type ConnectionHistoryPoint = {
  date: string;
  total_connections: number;
  distinct_connections: number;
};

export type NodeRow = {
  ciid: string;
  fqdn: string;
  hostname: string;
  distinct_edges: number;
  connection_count: number;
  first_seen: string;
  last_seen: string;
  group_name: string;
};

export function fetchDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>("/dashboard/stats");
}

export function fetchConnectionsHistory(days: number): Promise<ConnectionHistoryPoint[]> {
  return apiGet<ConnectionHistoryPoint[]>(`/dashboard/connections-history?days=${days}`);
}

export function fetchDashboardNodes(limit = 100): Promise<NodeRow[]> {
  return apiGet<NodeRow[]>(`/dashboard/nodes?limit=${limit}`);
}

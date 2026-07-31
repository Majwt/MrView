import { apiGet } from "@/api/client";

export type DashboardStats = {
  total_edges: number;
  active_nodes: number;
  total_seen_count: number;
  new_edges_last_7_days: number;
};

export type ConnectionHistoryPoint = {
  date: string;
  total_connections: number;
  distinct_connections: number;
};

export type ConnectionRow = {
  edge_key: string;
  endpoint_a: string;
  endpoint_b: string;
  service_name: string;
  service_port: number | null;
  protocol: string;
  seen_count: number;
  first_seen: string;
  last_seen: string;
};

export function fetchDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>("/dashboard/stats");
}

export function fetchConnectionsHistory(days: number): Promise<ConnectionHistoryPoint[]> {
  return apiGet<ConnectionHistoryPoint[]>(`/dashboard/connections-history?days=${days}`);
}

export function fetchTopConnections(limit = 100): Promise<ConnectionRow[]> {
  return apiGet<ConnectionRow[]>(`/dashboard/top-connections?limit=${limit}`);
}

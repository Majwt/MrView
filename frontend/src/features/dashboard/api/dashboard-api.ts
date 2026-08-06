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
  os: string;
  client_name: string;
  client_version: string;
  distinct_edges: number;
  connection_count: number;
  first_seen: string;
  last_seen: string;
  group_name: string;
};

function dashboardPath(path: string, customerId: number | null): string {
  return customerId == null
    ? `/dashboard/${path}`
    : `/customer/${customerId}/dashboard/${path}`;
}

export function fetchDashboardStats(customerId: number | null = null): Promise<DashboardStats> {
  return apiGet<DashboardStats>(dashboardPath("stats", customerId));
}

export function fetchConnectionsHistory(
  days: number,
  customerId: number | null = null,
): Promise<ConnectionHistoryPoint[]> {
  return apiGet<ConnectionHistoryPoint[]>(
    `${dashboardPath("connections-history", customerId)}?days=${days}`,
  );
}

export function fetchDashboardNodes(
  limit = 100,
  customerId: number | null = null,
): Promise<NodeRow[]> {
  return apiGet<NodeRow[]>(`${dashboardPath("nodes", customerId)}?limit=${limit}`);
}

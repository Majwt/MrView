import { apiGet } from "@/api/client";

export type DashboardMetric = {
  name: string;
  value: number;
  description_header: string;
  description_body: string;
  previous_value: number | null;
  percentage_change: number | null;
};

export type DashboardCardMetric = DashboardMetric & {
  id: string;
  display_order: number;
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
  client: string;
  client_version: string;
  distinct_edges: number;
  connection_count: number;
  first_seen: string;
  last_seen: string;
  group_name: string;
};

export type PagedNodeRows = {
  items: NodeRow[];
  total_count: number;
  page: number;
  page_size: number;
};

function dashboardPath(path: string, customerId: number | null): string {
  return customerId == null
    ? `/dashboard/${path}`
    : `/customer/${customerId}/dashboard/${path}`;
}

export function fetchDistinctEdgesMetric(
  lastDays: number,
  customerId: number | null = null,
): Promise<DashboardMetric> {
  return apiGet<DashboardMetric>(`${dashboardPath("distinct-edges", customerId)}?lastDays=${lastDays}`);
}

export function fetchActiveNodesMetric(
  lastDays: number,
  customerId: number | null = null,
): Promise<DashboardMetric> {
  return apiGet<DashboardMetric>(`${dashboardPath("active-nodes", customerId)}?lastDays=${lastDays}`);
}

export function fetchTotalEventsMetric(
  lastDays: number,
  customerId: number | null = null,
): Promise<DashboardMetric> {
  return apiGet<DashboardMetric>(`${dashboardPath("total-events", customerId)}?lastDays=${lastDays}`);
}

export function fetchNewConnectionsMetric(
  lastDays: number,
  customerId: number | null = null,
): Promise<DashboardMetric> {
  return apiGet<DashboardMetric>(`${dashboardPath("new-connections", customerId)}?lastDays=${lastDays}`);
}

export async function fetchDashboardMetrics(
  lastDays: number,
  customerId: number | null = null,
): Promise<Record<string, DashboardMetric>> {
  const [distinct_edges, active_nodes, total_events, new_connections] = await Promise.all([
    fetchDistinctEdgesMetric(lastDays, customerId),
    fetchActiveNodesMetric(lastDays, customerId),
    fetchTotalEventsMetric(lastDays, customerId),
    fetchNewConnectionsMetric(lastDays, customerId),
  ]);

  return { distinct_edges, active_nodes, total_events, new_connections };
}

export function fetchDashboardCards(
  lastDays: number,
  customerId: number | null = null,
): Promise<DashboardCardMetric[]> {
  return apiGet<DashboardCardMetric[]>(`${dashboardPath("cards", customerId)}?lastDays=${lastDays}`);
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

export function fetchDashboardNodesPage(
  page: number,
  pageSize: number,
  query: string,
  customerId: number | null = null,
): Promise<PagedNodeRows> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  const trimmed = query.trim();
  if (trimmed) {
    params.set("q", trimmed);
  }

  return apiGet<PagedNodeRows>(`${dashboardPath("nodes-page", customerId)}?${params.toString()}`);
}

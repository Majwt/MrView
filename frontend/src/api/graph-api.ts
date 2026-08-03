import { apiGet } from "@/api/client";
import type { GraphCursor, GraphDelta, GraphNode } from "@/features/graph/types";

export type GraphQueryParams = {
  excludeIsolated?: boolean;
  minLastSeenHours?: number | null;
  managedOnly?: boolean;
  distinctEdgesOnly?: boolean;
};

export type NodeFilterParams = {
  customer?: string;
  ip?: string;
  mac?: string;
  firstSeenAfter?: string;
  firstSeenBefore?: string;
  lastSeenAfter?: string;
  lastSeenBefore?: string;
};

function applyGraphQueryParams(params: URLSearchParams, queryParams?: GraphQueryParams) {
  if (queryParams?.excludeIsolated) params.set("excludeIsolated", "true");
  if (queryParams?.minLastSeenHours != null) params.set("minLastSeenHours", String(queryParams.minLastSeenHours));
  if (queryParams?.managedOnly) params.set("managedOnly", "true");
  if (queryParams?.distinctEdgesOnly) params.set("distinctEdgesOnly", "true");
}

export function fetchGraphSnapshot(customerId: number | null, queryParams?: GraphQueryParams): Promise<GraphDelta> {
  const url = customerId ? `/customer/${customerId}/graph` : "/graph";
  const params = new URLSearchParams();
  applyGraphQueryParams(params, queryParams);
  const query = params.toString();
  return apiGet<GraphDelta>(query ? `${url}?${query}` : url);
}

export function fetchGraphDelta(cursor: GraphCursor, customerId: number | null, queryParams?: GraphQueryParams): Promise<GraphDelta> {
  const url = customerId ? `/customer/${customerId}/graph` : "/graph";
  const params = new URLSearchParams({
    lastSeen: String(cursor.last_seen),
    lastEdgeId: String(cursor.last_seen_edge_id),
    lastNodeId: String(cursor.last_seen_node_id),
  });
  applyGraphQueryParams(params, queryParams);
  return apiGet<GraphDelta>(`${url}?${params.toString()}`);
}

export function fetchNodeDetails(ciid: string): Promise<GraphNode> {
  return apiGet<GraphNode>(`/node?ciid=${encodeURIComponent(ciid)}`);
}

export function fetchFilteredCiids(filterParams: NodeFilterParams): Promise<string[]> {
  const params = new URLSearchParams();
  if (filterParams.customer) params.set("customer", filterParams.customer);
  if (filterParams.ip) params.set("ip", filterParams.ip);
  if (filterParams.mac) params.set("mac", filterParams.mac);
  if (filterParams.firstSeenAfter) params.set("firstSeenAfter", filterParams.firstSeenAfter);
  if (filterParams.firstSeenBefore) params.set("firstSeenBefore", filterParams.firstSeenBefore);
  if (filterParams.lastSeenAfter) params.set("lastSeenAfter", filterParams.lastSeenAfter);
  if (filterParams.lastSeenBefore) params.set("lastSeenBefore", filterParams.lastSeenBefore);
  return apiGet<string[]>(`/nodes/filter?${params.toString()}`);
}


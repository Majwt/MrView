import { apiGet } from "@/api/client";
import type { GraphCursor, GraphDelta } from "@/features/graph/types";

export function fetchGraphSnapshot(customerId: number | null): Promise<GraphDelta> {
  console.log("Fetching graph snapshot for customerId:", customerId);
  const url = customerId ? `/customer/${customerId}/graph` : "/graph";
  return apiGet<GraphDelta>(url);
}

export function fetchGraphDelta(cursor: GraphCursor, customerId: number | null): Promise<GraphDelta> {
  console.log("Fetching graph delta with cursor:", cursor, "for customerId:", customerId);
  const url = customerId ? `/customer/${customerId}/graph` : "/graph";
  const params = new URLSearchParams({
    lastSeen: String(cursor.last_seen),
    lastEdgeId: String(cursor.last_seen_edge_id),
    lastNodeId: String(cursor.last_seen_node_id),
  });

  return apiGet<GraphDelta>(`${url}?${params.toString()}`);
}

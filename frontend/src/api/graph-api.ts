import { apiGet } from "@/api/client";
import type { GraphCursor, GraphDelta } from "@/features/graph/types";

export function fetchGraphSnapshot(): Promise<GraphDelta> {
  return apiGet<GraphDelta>("/graph");
}

export function fetchGraphDelta(cursor: GraphCursor): Promise<GraphDelta> {
  console.log("fetching graph delta with cursor:", cursor);
  const params = new URLSearchParams({
    lastSeen: cursor.last_seen,
    lastEdgeId: String(cursor.last_seen_edge_id),
    lastNodeId: String(cursor.last_seen_node_id),
  });
  console.log("fetching delta with params:", params.toString());

  return apiGet<GraphDelta>(`/graph?${params.toString()}`);
}

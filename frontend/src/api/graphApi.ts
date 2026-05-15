import type { GraphCursor, GraphData, GraphDeltaResponse, GraphSnapshotResponse } from "../types/graph";


export async function fetchGraphSnapshot(): Promise<GraphSnapshotResponse> {
  const response = await fetch("/api/graph/snapshot");

  if (!response.ok) {
    throw new Error("Failed to fetch graph snapshot");
  }

  return response.json();
}

export async function fetchGraphDelta(cursor: GraphCursor): Promise<GraphDeltaResponse> {
  const params = new URLSearchParams({
    since_last_seen: cursor.last_seen,
    since_row_id: cursor.last_row_id.toString(),
  });
  const response = await fetch(`/api/graph/delta?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch graph delta");
  }

  return response.json();
}

export function applyGraphDelta(current: GraphData, delta: GraphDeltaResponse): GraphData {
  const edgesById = new Map<string, GraphData["edges"][number]>();
  for (const edge of current.edges) {
    edgesById.set(edge.id, edge);
  }
  for (const edge of delta.upsert_edges) {
    edgesById.set(edge.id, edge);
  }
  for (const edgeId of delta.remove_edge_ids) {
    edgesById.delete(edgeId);
  }

  const nodesByFqdn = new Map<string, GraphData["nodes"][number]>();
  for (const node of current.nodes) {
    nodesByFqdn.set(node.fqdn, node);
  }
  for (const node of delta.upsert_nodes) {
    nodesByFqdn.set(node.fqdn, node);
  }
  for (const nodeId of delta.remove_node_ids) {
    nodesByFqdn.delete(nodeId);
  }
  for (const edge of edgesById.values()) {
    if (!nodesByFqdn.has(edge.source_fqdn)) {
      nodesByFqdn.set(edge.source_fqdn, { fqdn: edge.source_fqdn, ip: edge.source_ip });
    }
    if (!nodesByFqdn.has(edge.target_fqdn)) {
      nodesByFqdn.set(edge.target_fqdn, { fqdn: edge.target_fqdn, ip: edge.target_ip });
    }
  }

  return {
    nodes: [...nodesByFqdn.values()],
    edges: [...edgesById.values()],
  };
}

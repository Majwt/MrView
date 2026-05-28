import type { GraphDelta, GraphSnapshot } from "./types";

export function applyGraphDelta(current: GraphSnapshot, delta: GraphDelta): GraphSnapshot {
  const nodesByFqdn = new Map(current.nodes.map((node) => [node.fqdn, node]));

  const edgesById = new Map(current.edges.map((edge) => [edge.id, edge]));

  // Upsert nodes
  for (const node of delta.upsert_nodes) {
    nodesByFqdn.set(node.fqdn, node);
  }

  // Upsert edges
  for (const edge of delta.upsert_edges) {
    edgesById.set(edge.id, edge);
  }

  // Remove nodes
  for (const nodeId of delta.remove_node_ids) {
    nodesByFqdn.delete(nodeId);
  }

  // Remove edges
  for (const edgeId of delta.remove_edge_ids) {
    edgesById.delete(edgeId);
  }

  return {
    nodes: [...nodesByFqdn.values()],
    edges: [...edgesById.values()],
    cursor: delta.cursor,
  };
}

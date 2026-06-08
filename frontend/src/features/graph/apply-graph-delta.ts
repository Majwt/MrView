import type { GraphSnapshot, GraphDelta } from "./types";
import { normalizeGraphSnapshot } from "./normalize-graph-snapshot";

export function applyGraphDelta(current: GraphSnapshot, delta: GraphDelta): GraphSnapshot {
  const nodesByFqdn = new Map(
    current.nodes.filter((node) => !node.is_placeholder).map((node) => [node.fqdn, node]),
  );
  const edgesById = new Map(current.edges.map((edge) => [edge.id, edge]));
  const removeNodeFqdns = new Set(delta.remove_node_ids);
  const removeEdgeIds = new Set(delta.remove_edge_ids);

  for (const fqdn of removeNodeFqdns) {
    nodesByFqdn.delete(fqdn);
  }

  for (const node of delta.upsert_nodes) {
    nodesByFqdn.set(node.fqdn, node);
  }

  for (const edgeId of removeEdgeIds) {
    edgesById.delete(edgeId);
  }

  for (const edge of delta.upsert_edges) {
    edgesById.set(edge.id, edge);
  }

  return normalizeGraphSnapshot({
    nodes: [...nodesByFqdn.values()],
    edges: [...edgesById.values()],
    cursor: delta.cursor,
  });
}

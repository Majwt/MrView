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
    // Merge with existing node to preserve lazily-loaded details (interfaces, customer, etc.)
    const existing = nodesByFqdn.get(node.fqdn);
    nodesByFqdn.set(node.fqdn, existing ? mergeNode(existing, node) : node);
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

function mergeNode(existing: GraphSnapshot["nodes"][number], incoming: GraphSnapshot["nodes"][number]) {
  const merged = { ...existing, ...incoming };

  if (incoming.interfaces === undefined) {
    merged.interfaces = existing.interfaces;
  }
  if (incoming.customer === undefined) {
    merged.customer = existing.customer;
  }
  if (incoming.first_seen === undefined) {
    merged.first_seen = existing.first_seen;
  }
  if (incoming.last_seen === undefined) {
    merged.last_seen = existing.last_seen;
  }

  return merged;
}

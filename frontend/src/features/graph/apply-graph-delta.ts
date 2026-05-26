import type {
  GraphDelta,
  GraphSnapshot,
} from "./types"

export function applyGraphDelta(
  current: GraphSnapshot,
  delta: GraphDelta,
): GraphSnapshot {
  const nodesByFqdn = new Map(
    current.nodes.map((node) => [node.fqdn, node]),
  )

  const edgesById = new Map(
    current.edges.map((edge) => [edge.id, edge]),
  )

  // Upsert nodes
  for (const node of delta.nodes) {
    nodesByFqdn.set(node.fqdn, node)
  }

  // Upsert edges
  for (const edge of delta.edges) {
    edgesById.set(edge.id, edge)
  }

  return {
    nodes: [...nodesByFqdn.values()],
    edges: [...edgesById.values()],
    cursor: delta.cursor,
  }
}

import type { GraphEdge, GraphSnapshot } from "@/features/graph/types"
import type { ConnectionFilter } from "./filter-types"

export function applyConnectionFilters(
  edges: GraphEdge[],
  _filters: ConnectionFilter[],
): GraphEdge[] {
  // Placeholder for now.
  // Later this is where source/target/port/direction filters will be applied.
  console.warn("applyConnectionFilters is currently a no-op and returns the original edges. Filtering logic is not yet implemented.", _filters)
  return edges
}

export function applyConnectionFiltersToSnapshot(
  snapshot: GraphSnapshot,
  _filters: ConnectionFilter[],
): GraphSnapshot {

  console.warn("applyConnectionFiltersToSnapshot is currently a no-op and returns the original snapshot. Filtering logic is not yet implemented.", _filters)
  const filteredEdges = snapshot.edges

  const connectedNodeKeys = new Set<string>()

  for (const edge of filteredEdges) {
    connectedNodeKeys.add(edge.source_fqdn)
    connectedNodeKeys.add(edge.source_ip)
    connectedNodeKeys.add(edge.target_fqdn)
    connectedNodeKeys.add(edge.target_ip)
  }

  const filteredNodes = snapshot.nodes.filter((node) => {
    return (
      connectedNodeKeys.has(node.fqdn) ||
      connectedNodeKeys.has(node.ip)
    )
  })

  return {
    ...snapshot,
    nodes: filteredNodes,
    edges: filteredEdges,
  }
}

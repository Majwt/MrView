import type { GraphEdge, GraphNode, GraphSnapshot } from "../graph/types";

export function applyGlobalSearch(
  graph: GraphSnapshot | null,
  query: string,
  target: "node" | "connection",
): GraphSnapshot | null {
  if (!graph) return graph;

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return graph;

  if (target === "node") {
    const nodes = graph.nodes.filter((node) => nodeMatchesSearch(node, normalizedQuery));
    const visibleNodeIds = new Set(nodes.map((node) => node.fqdn));
    const edges = graph.edges.filter(
      (edge) => visibleNodeIds.has(edge.source_fqdn) && visibleNodeIds.has(edge.target_fqdn),
    );

    return { ...graph, nodes, edges };
  }

  const edges = graph.edges.filter((edge) => edgeMatchesSearch(edge, normalizedQuery));
  const connectedNodeIds = new Set<string>();

  for (const edge of edges) {
    connectedNodeIds.add(edge.source_fqdn);
    connectedNodeIds.add(edge.target_fqdn);
  }

  const nodes = graph.nodes.filter((node) => connectedNodeIds.has(node.fqdn));

  return { ...graph, nodes, edges };
}

function nodeMatchesSearch(node: GraphNode, query: string) {
  const values = [
    node.fqdn,
    node.hostname,
    String(node.distinct_edge),
    String(node.connection_count),
  ];

  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
}

function edgeMatchesSearch(edge: GraphEdge, query: string) {
  const values = [
    edge.protocol,
    edge.source_fqdn,
    edge.target_fqdn,
    edge.source_ip,
    edge.target_ip,
    String(edge.source_port),
    String(edge.target_port),
    edge.source_process_name,
    edge.target_process_name,
    edge.service_name,
    String(edge.seen_count),
    edge.first_seen,
    edge.last_seen,
  ];

  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
}

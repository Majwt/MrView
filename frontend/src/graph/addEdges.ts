import type { GraphData } from "../types/graph";

import type Graph from "graphology";

function getEdgeSize(seenCount: number): number {

  const baseSize = 4;
  const growth = Math.log2(Math.max(seenCount, 1)) * 0.2
  return baseSize + growth;
}

function getNodeSize(connectionCount: number): number {
  const baseSize = 10;
  const growth = Math.log2(Math.max(connectionCount, 1)) * 0.5;
  return baseSize + growth;
}


/**
 * Adds edges to the graph based on the provided GraphData.
 * If groupSameDirectionEdges is true, edges with the same source and target will be grouped together, and their attributes will be aggregated.
 *
 * @param graph - The graph to add edges to.
 * @param data - The graph data containing nodes and edges.
 * @param groupSameDirectionEdges - Whether to group edges with the same source and target.
 */
export function addEdges(
  graph: Graph,
  data: GraphData,
  groupSameDirectionEdges: boolean,
) {
  const connectionCountByFqdn = new Map<string, number>();
  for (const edge of data.edges) {
    const seenCount = Math.max(edge.seen_count ?? 1, 1);
    connectionCountByFqdn.set(edge.source_fqdn, (connectionCountByFqdn.get(edge.source_fqdn) ?? 0) + seenCount);
    connectionCountByFqdn.set(edge.target_fqdn, (connectionCountByFqdn.get(edge.target_fqdn) ?? 0) + seenCount);
  }



  if (!groupSameDirectionEdges) {
    data.edges.forEach((edge, index) => {
      const id =
        `${edge.source_fqdn}:${edge.source_port}->${edge.target_fqdn}:${edge.target_port}#${index}`;
      const seenCount = Math.max(edge.seen_count ?? 1, 1);

      graph.addEdgeWithKey(id, edge.source_fqdn, edge.target_fqdn, {
        port: edge.target_port,
        process_name: edge.process_name,
        process_id: edge.pid,
        size: getEdgeSize(seenCount),
      });
    });

    for (const [fqdn, count] of connectionCountByFqdn) {
      if (!graph.hasNode(fqdn)) continue;
      graph.setNodeAttribute(fqdn, "size", getNodeSize(count));
    }
    return;
  }

  const groups = new Map<string, typeof data.edges>();

  for (const edge of data.edges) {
    const key = `${edge.source_fqdn}->${edge.target_fqdn}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(edge);
  }

  for (const [key, edges] of groups) {
    const first = edges[0];
    const totalSeenCount = edges.reduce((sum, edge) => sum + Math.max(edge.seen_count ?? 1, 1), 0);

    graph.addEdgeWithKey(key, first.source_fqdn, first.target_fqdn, {
      count: totalSeenCount,
      connections: edges,
      label: `${totalSeenCount} connections`,
      type: "straight",
      size: getEdgeSize(totalSeenCount),
    });
  }

  for (const [fqdn, count] of connectionCountByFqdn) {
    if (!graph.hasNode(fqdn)) continue;
    graph.setNodeAttribute(fqdn, "size", getNodeSize(count));
  }
}

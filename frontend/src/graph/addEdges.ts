import type { GraphData } from "../types/graph";

import type Graph from "graphology";

/**
 *
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
  if (!groupSameDirectionEdges) {
    data.edges.forEach((edge, index) => {
      const id =
        `${edge.source_fqdn}:${edge.source_port}->${edge.target_fqdn}:${edge.target_port}#${index}`;
      const seenCount = Math.max(edge.seen_count ?? 1, 1);

      graph.addEdgeWithKey(id, edge.source_fqdn, edge.target_fqdn, {
        port: edge.target_port,
        process_name: edge.process_name,
        process_id: edge.pid,
        size: 3 + Math.log(seenCount + 1),
      });
    });

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
      size: 3 + 2 * Math.log(totalSeenCount + 1),
      count: totalSeenCount,
      connections: edges,
      label: `${totalSeenCount} connections`,
      type: "straight",
    });
  }
}

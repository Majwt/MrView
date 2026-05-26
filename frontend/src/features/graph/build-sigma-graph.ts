
import Graph from "graphology"

import type {
  GraphEdge,
  GraphNode,
} from "@/features/graph/types"

export function buildSigmaGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
) {
  const graph = new Graph({
    multi: true,
    type: "directed",
  })

  let counter = 0;
  for (const node of nodes) {
    graph.addNode(node.fqdn, {
      label: node.fqdn,
      ip: node.ip,
      customer: node.customer.name,
      x: Math.sin(counter) * 1,
      y: Math.cos(counter) * 1,
      size: 10,
    })
    counter++;
  }

  addEdges(graph, edges)

  // for (const edge of edges) {
  //   const source = edge.source_fqdn
  //   const target = edge.target_fqdn
  //
  //   if (!graph.hasNode(source) || !graph.hasNode(target)) {
  //     continue
  //   }
  //
  //   graph.addDirectedEdgeWithKey(edge.id, source, target, {
  //     label: String(edge.target_port),
  //     sourcePort: edge.source_port,
  //     targetPort: edge.target_port,
  //     processName: edge.process_name,
  //     seenCount: edge.seen_count,
  //     lastSeen: edge.last_seen,
  //     size: 7,
  //   })
  // }

  return graph
}



export function addEdges(graph: Graph, edges: GraphEdge[]) {
  const connectionCountByFqdn = new Map<string, number>()
  const groups = new Map<string, GraphEdge[]>()

  for (const edge of edges) {
    const source = edge.source_fqdn
    const target = edge.target_fqdn

    if (!graph.hasNode(source) || !graph.hasNode(target)) {
      continue
    }

    const seenCount = Math.max(edge.seen_count ?? 1, 1)

    // Count total connections per node
    connectionCountByFqdn.set(
      source,
      (connectionCountByFqdn.get(source) ?? 0) + seenCount,
    )

    connectionCountByFqdn.set(
      target,
      (connectionCountByFqdn.get(target) ?? 0) + seenCount,
    )

    // Group by direction
    const key = `${source}->${target}`

    if (!groups.has(key)) {
      groups.set(key, [])
    }

    groups.get(key)!.push(edge)
  }

  console.log("Grouped edges:", groups)
  // Create grouped edges
  for (const [key, groupedEdges] of groups) {
    const first = groupedEdges[0]

    const totalSeenCount = groupedEdges.reduce(
      (sum, edge) => sum + Math.max(edge.seen_count ?? 1, 1),
      0,
    )

    graph.addDirectedEdgeWithKey(
      key,
      first.source_fqdn,
      first.target_fqdn,
      {
        label: `${totalSeenCount}`,
        connections: groupedEdges,
        seenCount: totalSeenCount,
        sourcePort: first.source_port,
        targetPort: first.target_port,
        processName: first.process_name,
        lastSeen: first.last_seen,
        size: getEdgeSize(totalSeenCount),
      },
    )
  }

  // Apply node sizes
  for (const [fqdn, count] of connectionCountByFqdn) {
    if (!graph.hasNode(fqdn)) {
      continue
    }

    graph.setNodeAttribute(fqdn, "size", getNodeSize(count))
  }
  setupCurvedEdges(graph)
}
function getEdgeSize(totalSeenCount: number): any {
  return 10;
}

function getNodeSize(totalSeenCount: number): any {
  return 10;
}

import {
  DEFAULT_EDGE_CURVATURE,
  indexParallelEdgesIndex,
} from "@sigma/edge-curve";
import { MultiGraph } from "graphology";

function getCurvature(index: number, maxIndex: number): number {
  if (maxIndex <= 0) throw new Error("Invalid maxIndex");
  if (index < 0) return -getCurvature(-index, maxIndex);

  const amplitude = 3.5;
  const maxCurvature =
    amplitude *
    (1 - Math.exp(-maxIndex / amplitude)) *
    DEFAULT_EDGE_CURVATURE;

  return (maxCurvature * index) / maxIndex;
}

/**
 *
 * setupCurvedEdges analyzes the graph to identify parallel edges (edges with the same source and target) and assigns curvature attributes to them. It uses the indexParallelEdgesIndex function from the @sigma/edge-curve package to compute the parallel edge indices and then calculates the curvature for each edge based on its position among parallel edges.
 *
 * @param graph - The graph to set up curved edges for.
 *
 */
function setupCurvedEdges(graph: MultiGraph) {
  indexParallelEdgesIndex(graph, {
    edgeIndexAttribute: "parallelIndex",
    edgeMinIndexAttribute: "parallelMinIndex",
    edgeMaxIndexAttribute: "parallelMaxIndex",
  });

  graph.forEachEdge(
    (
      edge,
      {
        parallelIndex,
        parallelMinIndex,
        parallelMaxIndex,
      }:
        | {
            parallelIndex: number;
            parallelMinIndex?: number;
            parallelMaxIndex: number;
          }
        | {
            parallelIndex?: null;
            parallelMinIndex?: null;
            parallelMaxIndex?: null;
          },
    ) => {
      if (typeof parallelMinIndex === "number") {
        graph.mergeEdgeAttributes(edge, {
          type: parallelIndex ? "curved" : "straight",
          curvature: getCurvature(parallelIndex, parallelMaxIndex),
        });
      } else if (typeof parallelIndex === "number") {
        graph.mergeEdgeAttributes(edge, {
          type: "curved",
          curvature: getCurvature(parallelIndex, parallelMaxIndex),
        });
      } else {
        graph.setEdgeAttribute(edge, "type", "straight");
      }
    },
  );
}

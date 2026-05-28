import Graph from "graphology";

import type { GraphEdge, GraphNode } from "@/features/graph/types";

export function buildSigmaGraph(nodes: GraphNode[], edges: GraphEdge[]) {
  const graph = new Graph({
    multi: true,
    type: "directed",
  });

  for (const [index, node] of nodes.entries()) {
    graph.addNode(node.fqdn, getNodeAttributes(node, index));
  }

  addEdges(graph, edges);

  return graph;
}

export function syncSigmaGraph(graph: Graph, nodes: GraphNode[], edges: GraphEdge[]) {
  const nextNodeIds = new Set(nodes.map((node) => node.fqdn));

  for (const nodeId of graph.nodes()) {
    if (!nextNodeIds.has(nodeId)) {
      graph.dropNode(nodeId);
    }
  }

  for (const [index, node] of nodes.entries()) {
    if (graph.hasNode(node.fqdn)) {
      graph.mergeNodeAttributes(node.fqdn, getNodeAttributes(node, index, false));
    } else {
      graph.addNode(node.fqdn, getNodeAttributes(node, index));
    }
  }

  syncEdges(graph, edges);
}

function getNodeAttributes(node: GraphNode, index: number, includePosition = true) {
  return {
    label: node.fqdn,
    network: node.interfaces,
    customer: node.customer,
    ...(includePosition
      ? {
          x: Math.sin(index) * 1,
          y: Math.cos(index) * 1,
        }
      : {}),
    size: 10,
  };
}

export function addEdges(graph: Graph, edges: GraphEdge[]) {
  const groupedEdgesByKey = getGroupedEdges(graph, edges);

  for (const [key, groupedEdges] of groupedEdgesByKey) {
    const first = groupedEdges[0];

    graph.addDirectedEdgeWithKey(
      key,
      first.source_fqdn,
      first.target_fqdn,
      getEdgeAttributes(groupedEdges),
    );
  }

  setupCurvedEdges(graph);
}

function syncEdges(graph: Graph, edges: GraphEdge[]) {
  const groupedEdges = getGroupedEdges(graph, edges);
  const nextEdgeIds = new Set(groupedEdges.keys());

  for (const edgeId of graph.edges()) {
    if (!nextEdgeIds.has(edgeId)) {
      graph.dropEdge(edgeId);
    }
  }

  for (const [key, group] of groupedEdges) {
    const first = group[0];
    const attributes = getEdgeAttributes(group);

    if (graph.hasEdge(key)) {
      graph.mergeEdgeAttributes(key, attributes);
    } else {
      graph.addDirectedEdgeWithKey(key, first.source_fqdn, first.target_fqdn, attributes);
    }
  }

  setupCurvedEdges(graph);
}

function getGroupedEdges(graph: Graph, edges: GraphEdge[]) {
  const connectionCountByFqdn = new Map<string, number>();
  const groups = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    const source = edge.source_fqdn;
    const target = edge.target_fqdn;

    if (!graph.hasNode(source) || !graph.hasNode(target)) {
      continue;
    }

    const seenCount = Math.max(edge.seen_count ?? 1, 1);

    // Count total connections per node
    connectionCountByFqdn.set(source, (connectionCountByFqdn.get(source) ?? 0) + seenCount);

    connectionCountByFqdn.set(target, (connectionCountByFqdn.get(target) ?? 0) + seenCount);

    // Group by direction
    const key = `${source}->${target}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(edge);
  }

  // Apply node sizes
  for (const fqdn of connectionCountByFqdn.keys()) {
    if (!graph.hasNode(fqdn)) {
      continue;
    }

    graph.setNodeAttribute(fqdn, "size", 10);
  }

  return groups;
}

function getEdgeAttributes(groupedEdges: GraphEdge[]) {
  const first = groupedEdges[0];
  const totalSeenCount = groupedEdges.reduce(
    (sum, edge) => sum + Math.max(edge.seen_count ?? 1, 1),
    0,
  );

  return {
    label: `${totalSeenCount}`,
    connections: groupedEdges,
    seenCount: totalSeenCount,
    lastSeen: first.last_seen,
    size: 5,
  };
}

import { DEFAULT_EDGE_CURVATURE, indexParallelEdgesIndex } from "@sigma/edge-curve";
import { MultiGraph } from "graphology";

function getCurvature(index: number, maxIndex: number): number {
  if (maxIndex <= 0) throw new Error("Invalid maxIndex");
  if (index < 0) return -getCurvature(-index, maxIndex);

  const amplitude = 3.5;
  const maxCurvature = amplitude * (1 - Math.exp(-maxIndex / amplitude)) * DEFAULT_EDGE_CURVATURE;

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

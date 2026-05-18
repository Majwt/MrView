import Graph from "graphology";
import type { MultiGraph } from "graphology";
import type { GraphData } from "../types/graph";
import { addNodes } from "./addNodes";
import { addEdges } from "./addEdges";
import { setupCurvedEdges } from "./setupCurvedEdges";

export function syncGraph(graph: Graph, data: GraphData) {
  const nextGraph = new Graph({
    multi: true,
    type: "directed",
  });

  addNodes(nextGraph, data);
  addEdges(nextGraph, data, true);
  setupCurvedEdges(nextGraph as unknown as MultiGraph);

  const nextNodeIds = new Set(nextGraph.nodes());
  for (const node of graph.nodes()) {
    if (!nextNodeIds.has(node)) {
      graph.dropNode(node);
    }
  }

  const nextEdgeIds = new Set(nextGraph.edges());
  for (const edge of graph.edges()) {
    if (!nextEdgeIds.has(edge)) {
      graph.dropEdge(edge);
    }
  }

  for (const node of nextGraph.nodes()) {
    const nextAttrs = nextGraph.getNodeAttributes(node);
    if (!graph.hasNode(node)) {
      graph.addNode(node, nextAttrs);
      continue;
    }

    const currentAttrs = graph.getNodeAttributes(node) as { x?: number; y?: number; fixed?: boolean };
    graph.replaceNodeAttributes(node, {
      ...nextAttrs,
      x: currentAttrs.x ?? nextAttrs.x,
      y: currentAttrs.y ?? nextAttrs.y,
      fixed: currentAttrs.fixed,
    });
  }

  for (const edge of nextGraph.edges()) {
    const nextAttrs = nextGraph.getEdgeAttributes(edge);
    if (graph.hasEdge(edge)) {
      graph.replaceEdgeAttributes(edge, nextAttrs);
      continue;
    }

    const [source, target] = nextGraph.extremities(edge);
    if (!graph.hasNode(source) || !graph.hasNode(target)) continue;
    graph.addEdgeWithKey(edge, source, target, nextAttrs);
  }
}

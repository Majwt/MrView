
import "./GraphView.css";
import { useEffect, useRef, useState, type JSX } from "react";
import Sigma from "sigma";
import type { EdgeDetails, GraphData, GraphEdge, NodeDetails } from "../types/graph.ts";
import { createGraph } from "../graph/createGraph.ts";
import ForceSupervisor from "graphology-layout-force/worker";
import type Graph from "graphology";
import type { filter } from "../types/filter.ts";
// import forceAtlas2 from "graphology-layout-forceatlas2";
import type { SigmaNodeEventPayload, MouseCoords } from "sigma/types";
import { setupBackgroundGrid } from "../graph/setupBackgroundGrid.ts";
import { nodeReducer } from "../graph/nodeReducer.ts";
import { edgeReducer } from "../graph/edgeReducer.ts";
import { buildEffectiveFilters } from "../filters/matchesFilter.ts";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { syncGraph } from "../graph/syncGraph.ts";

type props = {
  data: GraphData;
  filters: filter[];
  onSelectNode: (node: string, attrs: NodeDetails | null) => void;
  onSelectEdge: (edge: EdgeDetails | null) => void;
  selectedEdgeId: string;
  searchQuery: string;
  searchSelection: string;
  searchSelectionVersion: number;
};

// Feels like this component is doing a lot, but I'm not sure how to split it without making the code more complicated.
// Maybe the graph event handlers could be extracted to a custom hook? Or maybe the layout and background grid setup could be extracted to custom hooks? Not sure if it's worth it.
// Too late now. 

/**
 * GraphView component renders an interactive graph visualization using Sigma.js.
 *
 * @param {GraphData} data - The graph data containing nodes and edges to visualize.
 * @param {(node: string, attrs: NodeDetails | null) => void} onSelectNode - Callback function triggered when a node is selected, providing the node ID and its attributes.
 * @param {filter[]} filters - An array of filter objects to apply to the graph visualization, allowing dynamic styling and visibility based on node and edge attributes.
 * @param {string} searchQuery - The current search query string used to filter nodes and edges in the graph visualization.
 * @returns {JSX.Element} The rendered GraphView component containing the graph visualization.
 *
 */
export default function GraphView({ data, filters, onSelectNode, onSelectEdge, selectedEdgeId: initialSelectedEdgeId, searchQuery, searchSelection, searchSelectionVersion }: props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);


  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectedNodeIds, setConnectedNodeIds] = useState<Set<string>>(new Set());
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);


  const textColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--text-h")
    .trim();
  const backgroundColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--bg")
    .trim();

  useEffect(() => {
    if (!containerRef.current) return;

    const [renderer, graph] = createGraph(
      containerRef.current,
      data,
      {
        text: textColor,
        background: backgroundColor
      });
    rendererRef.current = renderer;
    graphRef.current = graph;

    setupGraphEvents(renderer, graph, setSelectedNodeId, setSelectedEdgeId, setConnectedNodeIds, setHoveredEdgeId, onSelectNode, onSelectEdge);
    setupReducers(renderer, graph, selectedNodeId, selectedEdgeId, connectedNodeIds, hoveredEdgeId, filters, searchQuery);


    // background grid
    const backgroundCleanup = setupBackgroundGrid(renderer, containerRef.current, gridRef);
    // layout
    const layoutCleanup = forceSupervisorLayout(renderer, graph);

    return () => {
      backgroundCleanup();
      layoutCleanup();
      renderer.kill();
      rendererRef.current = null;
      graphRef.current = null;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textColor, backgroundColor, onSelectNode, onSelectEdge]);

  useEffect(() => {
    if (!rendererRef.current || !graphRef.current) return;

    syncGraph(graphRef.current, data);

    if (selectedNodeId && !graphRef.current.hasNode(selectedNodeId)) {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectedNodeIds(new Set());
      onSelectNode("", null);
      onSelectEdge(null);
    } else if (selectedEdgeId && !graphRef.current.hasEdge(selectedEdgeId)) {
      setSelectedEdgeId(null);
      setConnectedNodeIds(new Set());
      onSelectEdge(null);
    }

    rendererRef.current.refresh();
  }, [data, onSelectEdge, onSelectNode, selectedEdgeId, selectedNodeId]);

  useEffect(() => {
    if (!rendererRef.current || !graphRef.current) return;
    setupReducers(rendererRef.current, graphRef.current, selectedNodeId, selectedEdgeId, connectedNodeIds, hoveredEdgeId, filters, searchQuery);
  }, [selectedNodeId, selectedEdgeId, connectedNodeIds, hoveredEdgeId, filters, searchQuery]);

  useEffect(() => {
    if (!searchSelection || !rendererRef.current || !graphRef.current) return;
    if (!graphRef.current.hasNode(searchSelection)) return;

    selectNode(searchSelection, rendererRef.current, graphRef.current, setSelectedNodeId, setSelectedEdgeId, setConnectedNodeIds, onSelectNode, onSelectEdge);
  }, [searchSelection, searchSelectionVersion, onSelectNode, onSelectEdge]);

  useEffect(() => {
    if (!graphRef.current) return;
    if (!initialSelectedEdgeId) return;

    if (!graphRef.current.hasEdge(initialSelectedEdgeId)) return;

    selectEdge(initialSelectedEdgeId, graphRef.current, setSelectedNodeId, setSelectedEdgeId, setConnectedNodeIds, onSelectNode, onSelectEdge);
  }, [initialSelectedEdgeId, onSelectNode, onSelectEdge]);

  return <div ref={containerRef} className="graphview-canvas" />;
}


function setupReducers(renderer: Sigma, graph: Graph, selectedNodeId: string | null, selectedEdgeId: string | null, connectedNodeIds: Set<string>, hoveredEdgeId: string | null, filters: filter[], searchQuery: string) {
  const effectiveFilters = buildEffectiveFilters(filters, searchQuery);
  renderer.setSetting("nodeReducer", (node, data) => nodeReducer(node, graph, connectedNodeIds, selectedNodeId, selectedEdgeId, data, effectiveFilters));
  renderer.setSetting("edgeReducer", (edge, data) => edgeReducer(graph, edge, data, selectedNodeId || "", selectedEdgeId, hoveredEdgeId, effectiveFilters));
  renderer.refresh();

}

// Jag avskyr hur många parametrar dessa funktioner har
function setupGraphEvents(renderer: Sigma, graph: Graph, setSelectedNodeId: (nodeId: string | null) => void, setSelectedEdgeId: (edgeId: string | null) => void, setConnectedNodeIds: (nodeIds: Set<string>) => void, setHoveredEdgeId: (edgeId: string | null) => void, onSelectNode: (node: string, attrs: NodeDetails | null) => void, onSelectEdge: (edge: EdgeDetails | null) => void) {

  renderer.on("clickNode", ({ node }) => {
    selectNode(node, renderer, graph, setSelectedNodeId, setSelectedEdgeId, setConnectedNodeIds, onSelectNode, onSelectEdge);
  });

  renderer.on("clickEdge", ({ edge }) => {
    selectEdge(edge, graph, setSelectedNodeId, setSelectedEdgeId, setConnectedNodeIds, onSelectNode, onSelectEdge);
  });

  renderer.on("enterEdge", ({ edge }) => {
    setHoveredEdgeId(edge);
  });

  renderer.on("leaveEdge", () => {
    setHoveredEdgeId(null);
  });

  renderer.on("clickStage", () => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectedNodeIds(new Set());
    setHoveredEdgeId(null);
    renderer.refresh();
    onSelectNode("", null);
    onSelectEdge(null);
  });

}

// Jag avskyr hur många parametrar dessa funktioner har
function selectNode(
  node: string,
  renderer: Sigma,
  graph: Graph,
  setSelectedNodeId: (nodeId: string | null) => void,
  setSelectedEdgeId: (edgeId: string | null) => void,
  setConnectedNodeIds: (nodeIds: Set<string>) => void,
  onSelectNode: (node: string, attrs: NodeDetails | null) => void,
  onSelectEdge: (edge: EdgeDetails | null) => void
) {

  const connectedNodeIds = new Set([node]);
  graph.forEachNeighbor(node, (neighbor) => connectedNodeIds.add(neighbor));
  setSelectedNodeId(node);
  setSelectedEdgeId(null);
  setConnectedNodeIds(connectedNodeIds);
  renderer.refresh();
  const attrs = graph.getNodeAttributes(node) as NodeDetails;
  onSelectNode(node, attrs);
  onSelectEdge(null);
}

function selectEdge(
  edge: string,
  graph: Graph,
  setSelectedNodeId: (nodeId: string | null) => void,
  setSelectedEdgeId: (edgeId: string | null) => void,
  setConnectedNodeIds: (nodeIds: Set<string>) => void,
  onSelectNode: (node: string, attrs: NodeDetails | null) => void,
  onSelectEdge: (edge: EdgeDetails | null) => void
) {
  const [sourceNodeId, targetNodeId] = graph.extremities(edge);
  const sourceNode = graph.getNodeAttributes(sourceNodeId) as NodeDetails;
  const targetNode = graph.getNodeAttributes(targetNodeId) as NodeDetails;
  const edgeAttributes = graph.getEdgeAttributes(edge) as { connections?: unknown };
  const connections = Array.isArray(edgeAttributes.connections) ? edgeAttributes.connections as GraphEdge[] : [];

  setSelectedNodeId(null);
  setSelectedEdgeId(edge);
  setConnectedNodeIds(new Set([sourceNodeId, targetNodeId]));
  onSelectNode("", null);
  onSelectEdge({
    id: edge,
    source_fqdn: sourceNode.fqdn,
    source_ip: sourceNode.ip,
    target_fqdn: targetNode.fqdn,
    target_ip: targetNode.ip,
    connections,
  });
}

function forceAtlas2Layout(_renderer: Sigma, graph: Graph) {
  forceAtlas2.assign(graph, {
    iterations: 100,
    settings: {
      gravity: 2.5,
      scalingRatio: 2,
      strongGravityMode: false,
    },
  });

  return () => { };
}
void forceAtlas2Layout;

function forceSupervisorLayout(renderer: Sigma, graph: Graph) {

  const layout = new ForceSupervisor(graph, {
    isNodeFixed: (_, attr) => attr.fixed, settings: {
      attraction: 0.0005,
      repulsion: 1,
    },
  });

  const cleanup_drag = enableNodeDragging(renderer, graph, layout);
  layout.start();
  return () => {
    cleanup_drag();
    layout.stop();
    layout.kill();
  }
}
void forceSupervisorLayout;


function enableNodeDragging(
  renderer: Sigma,
  graph: Graph,
  supervisor?: ForceSupervisor
) {
  let draggedNode: string | null = null;
  let isDragging = false;

  const onDownNode = (e: SigmaNodeEventPayload) => {
    isDragging = true;
    draggedNode = e.node;

    graph.setNodeAttribute(draggedNode, "fixed", true);
    renderer.getCamera().disable();

    // supervisor?.stop(); // optional
  };

  const onMouseMove = (e: MouseCoords) => {
    if (!isDragging || !draggedNode) return;

    const pos = renderer.viewportToGraph(e);

    graph.setNodeAttribute(draggedNode, "x", pos.x);
    graph.setNodeAttribute(draggedNode, "y", pos.y);

    e.preventSigmaDefault();
    e.original.preventDefault();
    e.original.stopPropagation();
  };

  const onMouseUp = () => {
    if (draggedNode) {
      graph.removeNodeAttribute(draggedNode, "fixed");
    }

    isDragging = false;
    draggedNode = null;

    renderer.getCamera().enable();
    supervisor?.start(); // optional
  };

  renderer.on("downNode", onDownNode);
  renderer.getMouseCaptor().on("mousemovebody", onMouseMove);
  renderer.getMouseCaptor().on("mouseup", onMouseUp);

  // cleanup function
  return () => {
    renderer.removeListener("downNode", onDownNode);
    renderer.getMouseCaptor().removeListener("mousemovebody", onMouseMove);
    renderer.getMouseCaptor().removeListener("mouseup", onMouseUp);
  };
}

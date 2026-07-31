import type { GraphEdge, GraphNode, GraphSnapshot } from "@/features/graph/types";
import * as d3 from "d3";
import { useEffect, useRef } from "react";
import {
  buildEdgeMetadata,
  buildLabelZoomThresholds,
  createGraphEdges,
  findVisibleNodeAt,
  getFocusState,
  renderGraph,
  type CanvasDragSubject,
} from "@/features/graph/build-d3-graph";

type Props = {
  graphData: GraphSnapshot | null;
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
  hoveredNodeId?: string | null;
  hoveredEdgeIds?: Set<string>;
  selectedNodeId?: string | null;
  onEdgeHoverChange?: (edgeIds: string[]) => void;
  onNodeHoverChange?: (fqdn: string | null) => void;
  onNodeHoverPositionChange?: (position: { x: number; y: number } | null) => void;
  onNodeSelect?: (fqdn: string) => void;
  onStageClick?: () => void;
};

export default function GraphViewD3({
  graphData,
  visibleEdgeIds,
  visibleNodeIds,
  hoveredNodeId,
  hoveredEdgeIds,
  selectedNodeId,
  onEdgeHoverChange,
  onNodeHoverChange,
  onNodeHoverPositionChange,
  onNodeSelect,
  onStageClick,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRenderRef = useRef<() => void>(() => { });
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const dimensionsRef = useRef({ width: 1, height: 1 });
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const edgePairCountsRef = useRef<Map<string, number>>(new Map());
  const labelZoomThresholdsRef = useRef<Map<string, number>>(new Map());
  // adjacency map: nodeFqdn → edge IDs (rebuilt when graph data changes)
  const nodeEdgeMapRef = useRef<Map<string, string[]>>(new Map());
  const topologySignatureRef = useRef({ nodes: "", edges: "" });
  const latestRef = useRef({
    visibleNodeIds,
    visibleEdgeIds,
    hoveredNodeId,
    hoveredEdgeIds,
    selectedNodeId,
    onEdgeHoverChange,
    onNodeHoverChange,
    onNodeHoverPositionChange,
    onNodeSelect,
    onStageClick,
  });

  // Always keep the latest callbacks in the ref so D3 handlers use current closures.
  useEffect(() => {
    latestRef.current = {
      visibleNodeIds,
      visibleEdgeIds,
      hoveredNodeId,
      hoveredEdgeIds,
      selectedNodeId,
      onEdgeHoverChange,
      onNodeHoverChange,
      onNodeHoverPositionChange,
      onNodeSelect,
      onStageClick,
    };
  });

  // Only repaint when filter/selection props change.
  // Hover-driven repaints are handled directly by the D3 event handlers below.
  useEffect(() => {
    requestRenderRef.current();
  }, [visibleNodeIds, visibleEdgeIds, selectedNodeId]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parentElement = canvas.parentElement;
    if (!parentElement) return;
    const resizeTarget = parentElement;

    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 1;
    let height = 1;
    let transform = d3.zoomIdentity;
    let hoveredNode: GraphNode | null = null;
    let localHoveredEdgeIds = new Set<string>();
    let pendingFrame = 0;
    let textColor = "#111827";
    let labelBackground = "#ffffff";

    function refreshStyles() {
      const styles = getComputedStyle(canvas!);
      textColor = styles.color || "#111827";
      labelBackground = styles.getPropertyValue("--background").trim() || "#ffffff";
    }
    refreshStyles();

    const simulation = d3
      .forceSimulation<GraphNode, GraphEdge>(nodesRef.current)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphEdge>(edgesRef.current)
          .id((node) => node.fqdn)
          .distance(55),
      )
      .force("charge", d3.forceManyBody().strength(-80))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.04))
      .on("tick", requestRender);

    simulationRef.current = simulation;

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 10])
      .filter((event) => {
        if (event.type !== "mousedown") return true;
        return !findNodeAt(d3.pointer(event, canvas));
      })
      .on("zoom", (event) => {
        transform = event.transform;
        canvas.style.cursor = hoveredNode ? "pointer" : "grab";
        requestRender();
      });

    const drag = d3
      .drag<HTMLCanvasElement, unknown, CanvasDragSubject | null>()
      .subject((event) => {
        const node = findNodeAt(d3.pointer(event, canvas));
        if (!node) return null;

        const [x, y] = transform.apply([node.x, node.y]);
        return { node, x, y };
      })
      .on("start", (event) => {
        if (!event.subject) return;
        event.sourceEvent?.stopPropagation();
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.node.fx = event.subject.node.x;
        event.subject.node.fy = event.subject.node.y;
      })
      .on("drag", (event) => {
        if (!event.subject) return;
        event.sourceEvent?.stopPropagation();
        const [x, y] = transform.invert([event.x, event.y]);
        event.subject.node.fx = x;
        event.subject.node.fy = y;
        requestRender();
      })
      .on("end", (event) => {
        if (!event.subject) return;
        if (!event.active) simulation.alphaTarget(0);
        event.subject.node.fx = null;
        event.subject.node.fy = null;
      });

    const canvasSelection = d3.select(canvas);
    canvasSelection.call(zoom);
    canvasSelection.call(drag);
    canvasSelection
      .on("mousemove.graph", (event) => {
        const node = findNodeAt(d3.pointer(event, canvas));

        if (node?.fqdn !== hoveredNode?.fqdn) {
          hoveredNode = node;
          const connectedEdgeIds = node
            ? (nodeEdgeMapRef.current.get(node.fqdn) ?? [])
            : [];
          localHoveredEdgeIds = new Set(connectedEdgeIds);
          latestRef.current.onNodeHoverChange?.(node?.fqdn ?? null);
          latestRef.current.onEdgeHoverChange?.(connectedEdgeIds);
          // Only repaint when the hovered node actually changes.
          requestRender();
        }

        if (node) {
          const [screenX, screenY] = transform.apply([node.x, node.y]);
          latestRef.current.onNodeHoverPositionChange?.({ x: screenX, y: screenY });
        } else {
          latestRef.current.onNodeHoverPositionChange?.(null);
        }

        canvas.style.cursor = node ? "pointer" : "grab";
      })
      .on("mouseleave.graph", () => {
        hoveredNode = null;
        localHoveredEdgeIds = new Set();
        latestRef.current.onNodeHoverChange?.(null);
        latestRef.current.onEdgeHoverChange?.([]);
        latestRef.current.onNodeHoverPositionChange?.(null);
        canvas.style.cursor = "grab";
        requestRender();
      })
      .on("click.graph", (event) => {
        const node = findNodeAt(d3.pointer(event, canvas));
        if (node) {
          latestRef.current.onNodeSelect?.(node.fqdn);
        } else {
          latestRef.current.onStageClick?.();
        }
      });

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(resizeTarget);
    requestRenderRef.current = requestRender;
    resizeCanvas();

    return () => {
      requestRenderRef.current = () => { };
      cancelAnimationFrame(pendingFrame);
      canvasSelection.on(".zoom", null);
      canvasSelection.on(".drag", null);
      canvasSelection.on(".graph", null);
      resizeObserver.disconnect();
      simulation.stop();
      simulationRef.current = null;
    };

    function resizeCanvas() {
      if (!canvas) return;
      const parentBounds = resizeTarget.getBoundingClientRect();
      width = Math.max(parentBounds.width || resizeTarget.clientWidth || 640, 1);
      height = Math.max(parentBounds.height || resizeTarget.clientHeight || 400, 1);
      dimensionsRef.current = { width, height };

      refreshStyles();

      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);

      simulation
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("x", d3.forceX(width / 2).strength(0.04))
        .force("y", d3.forceY(height / 2).strength(0.04))
        .alpha(0.35)
        .restart();

      requestRender();
    }

    function requestRender() {
      if (pendingFrame) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        render();
      });
    }

    function render() {
      if (!canvas) return;
      if (!context) return;
      const pixelRatio = window.devicePixelRatio || 1;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const focus = getFocusState({
        edges,
        hoveredEdgeIds: localHoveredEdgeIds,
        hoveredNode,
        hoveredNodeId: latestRef.current.hoveredNodeId,
        nodes,
        selectedNodeId: latestRef.current.selectedNodeId,
        visibleEdgeIds: latestRef.current.visibleEdgeIds,
        visibleNodeIds: latestRef.current.visibleNodeIds,
      });

      renderGraph({
        context,
        edgePairCounts: edgePairCountsRef.current,
        edges,
        focus,
        height,
        hoveredEdgeIds: localHoveredEdgeIds,
        hoveredNode,
        hoveredNodeId: latestRef.current.hoveredNodeId,
        labelBackground,
        labelZoomThresholds: labelZoomThresholdsRef.current,
        nodes,
        pixelRatio,
        selectedNodeId: latestRef.current.selectedNodeId,
        textColor,
        transform,
        visibleEdgeIds: latestRef.current.visibleEdgeIds,
        visibleNodeIds: latestRef.current.visibleNodeIds,
        width,
      });
    }

    function findNodeAt([screenX, screenY]: [number, number]) {
      return findVisibleNodeAt({
        point: [screenX, screenY],
        simulation,
        transform,
        visibleNodeIds: latestRef.current.visibleNodeIds,
      });
    }
  }, []);

  useEffect(() => {
    if (!graphData) {
      nodesRef.current = [];
      edgesRef.current = [];
      edgePairCountsRef.current = new Map();
      labelZoomThresholdsRef.current = new Map();
      nodeEdgeMapRef.current = new Map();
      topologySignatureRef.current = { nodes: "", edges: "" };
      simulationRef.current?.nodes(nodesRef.current);
      const linkForce = simulationRef.current?.force<d3.ForceLink<GraphNode, GraphEdge>>("link");
      linkForce?.links(edgesRef.current);
      requestRenderRef.current();
      return;
    }

    const existingNodes = new Map(nodesRef.current.map((node) => [node.fqdn, node]));
    const cx = dimensionsRef.current.width / 2;
    const cy = dimensionsRef.current.height / 2;
    const nextNodes = graphData.nodes.map((nextNode) => {
      const existingNode = existingNodes.get(nextNode.fqdn);

      if (!existingNode) {
        return { ...nextNode, x: cx, y: cy };
      }

      const { x, y, vx, vy, fx, fy } = existingNode;
      Object.assign(existingNode, nextNode, { x, y, vx, vy, fx, fy });

      return existingNode;
    });

    const nodeIds = new Set(nextNodes.map((node) => node.fqdn));
    const nextEdges = createGraphEdges(graphData.edges, nodeIds);
    const { connectionCountByNode, edgePairCounts } = buildEdgeMetadata(nextEdges);
    const nextTopologySignature = {
      nodes: [...nodeIds].sort().join("\n"),
      edges: nextEdges.map((edge) => edge.id).sort().join("\n"),
    };
    const topologyChanged =
      nextTopologySignature.nodes !== topologySignatureRef.current.nodes ||
      nextTopologySignature.edges !== topologySignatureRef.current.edges;

    // Build adjacency map: nodeFqdn → [edgeId, ...] for O(1) hover lookups.
    const nodeEdgeMap = new Map<string, string[]>();
    for (const edge of nextEdges) {
      const src = edge.source_fqdn;
      const tgt = edge.target_fqdn;
      if (!nodeEdgeMap.has(src)) nodeEdgeMap.set(src, []);
      if (!nodeEdgeMap.has(tgt)) nodeEdgeMap.set(tgt, []);
      nodeEdgeMap.get(src)!.push(edge.id);
      nodeEdgeMap.get(tgt)!.push(edge.id);
    }

    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    edgePairCountsRef.current = edgePairCounts;
    nodeEdgeMapRef.current = nodeEdgeMap;
    labelZoomThresholdsRef.current = buildLabelZoomThresholds(nextNodes, connectionCountByNode);
    topologySignatureRef.current = nextTopologySignature;

    const simulation = simulationRef.current;
    if (!simulation) {
      requestRenderRef.current();
      return;
    }

    simulation.nodes(nodesRef.current);
    const linkForce = simulation.force<d3.ForceLink<GraphNode, GraphEdge>>("link");
    linkForce?.links(edgesRef.current);

    if (topologyChanged) {
      simulation.alpha(Math.max(simulation.alpha(), 0.08)).restart();
    }
    requestRenderRef.current();
  }, [graphData]);


  return (
    <canvas
      ref={canvasRef}
      aria-label="D3 force-directed graph"
      className="absolute inset-0 block h-full w-full touch-none"
      role="img"
    />
  );
}

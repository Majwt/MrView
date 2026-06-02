import type { GraphEdge, GraphNode } from "@/features/graph/types";
import * as d3 from "d3";
import { useEffect, useRef } from "react";
import {
  buildEdgeMetadata,
  buildLabelZoomThresholds,
  createD3Edges,
  createD3Nodes,
  edgeConnectionIds,
  edgesConnectedTo,
  findVisibleNodeAt,
  getFocusState,
  renderGraph,
  type CanvasDragSubject,
  type D3Edge,
  type D3Node,
} from "@/features/graph/build-d3-graph";

type Props = {
  edges: GraphEdge[];
  nodes: GraphNode[];
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
  nodes: allNodes,
  edges: allEdges,
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
  const requestRenderRef = useRef<() => void>(() => {});
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
    requestRenderRef.current();
  });

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
    let hoveredNode: D3Node | null = null;
    let pendingFrame = 0;

    const nodes = createD3Nodes(allNodes);
    const nodeIds = new Set(nodes.map((node) => node.fqdn));
    const edges = createD3Edges(allEdges, nodeIds);
    const { connectionCountByNode, edgePairCounts } = buildEdgeMetadata(edges);

    const labelZoomThresholds = buildLabelZoomThresholds(nodes, connectionCountByNode);

    const simulation = d3
      .forceSimulation<D3Node>(nodes)
      .force(
        "link",
        d3
          .forceLink<D3Node, D3Edge>(edges)
          .id((node) => node.fqdn)
          .distance(55),
      )
      .force("charge", d3.forceManyBody().strength(-80))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.04))
      .on("tick", requestRender);

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
          latestRef.current.onNodeHoverChange?.(node?.fqdn ?? null);
          latestRef.current.onEdgeHoverChange?.(
            node ? edgesConnectedTo(edges, nodes, node).flatMap(edgeConnectionIds) : [],
          );
        }

        if (node) {
          const [screenX, screenY] = transform.apply([node.x, node.y]);
          latestRef.current.onNodeHoverPositionChange?.({ x: screenX, y: screenY });
        } else {
          latestRef.current.onNodeHoverPositionChange?.(null);
        }

        canvas.style.cursor = node ? "pointer" : "grab";
        requestRender();
      })
      .on("mouseleave.graph", () => {
        hoveredNode = null;
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
      requestRenderRef.current = () => {};
      cancelAnimationFrame(pendingFrame);
      canvasSelection.on(".zoom", null);
      canvasSelection.on(".drag", null);
      canvasSelection.on(".graph", null);
      resizeObserver.disconnect();
      simulation.stop();
    };

    function resizeCanvas() {
      if (!canvas) return;
      const parentBounds = resizeTarget.getBoundingClientRect();
      width = Math.max(parentBounds.width || resizeTarget.clientWidth || 640, 1);
      height = Math.max(parentBounds.height || resizeTarget.clientHeight || 400, 1);

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
      const pixelRatio = window.devicePixelRatio || 1;
      const styles = getComputedStyle(canvas);
      const textColor = styles.color || "#111827";
      const labelBackground = styles.getPropertyValue("--background").trim() || "#ffffff";

      if (!context) return;
      const focus = getFocusState({
        edges,
        hoveredEdgeIds: latestRef.current.hoveredEdgeIds,
        hoveredNode,
        hoveredNodeId: latestRef.current.hoveredNodeId,
        nodes,
        selectedNodeId: latestRef.current.selectedNodeId,
        visibleEdgeIds: latestRef.current.visibleEdgeIds,
        visibleNodeIds: latestRef.current.visibleNodeIds,
      });

      renderGraph({
        context,
        edgePairCounts,
        edges,
        focus,
        height,
        hoveredEdgeIds: latestRef.current.hoveredEdgeIds,
        hoveredNode,
        hoveredNodeId: latestRef.current.hoveredNodeId,
        labelBackground,
        labelZoomThresholds,
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
  }, [allEdges, allNodes]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="D3 force-directed graph"
      className="absolute inset-0 block h-full w-full touch-none"
      role="img"
    />
  );
}

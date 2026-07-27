import type { GraphEdge, GraphNode } from "@/features/graph/types";
import { fqdnToColor } from "@/lib/cssVarColor";
import * as d3 from "d3";


export type CanvasDragSubject = {
  node: GraphNode;
  x: number;
  y: number;
};

export type FocusState = {
  edgeIds: Set<string>;
  nodeIds: Set<string>;
  isActive: boolean;
};

export const NODE_RADIUS = 4;
export const NODE_HIT_RADIUS = 20;

const EDGE_WIDTH = 0.2;
const ARROW_HEAD_LENGTH = 3;
const ARROW_HEAD_WIDTH = 2;
const LABEL_FONT_SIZE = 12;
const LABEL_STROKE_WIDTH = 4;
const LABEL_NODE_GAP = 10;
const LABEL_FULL_VISIBILITY_ZOOM = 2.1;
const LABEL_MIN_VISIBILITY_ZOOM = 0.3;
const DIMMED_COLOR = "rgba(148, 163, 184, 0.18)";
const DIMMED_TEXT_COLOR = "rgba(148, 163, 184, 0.0)";
const DEFAULT_EDGE_COLOR = "rgba(148, 163, 184, 1)";
const HIGHLIGHT_COLOR = "#ff88ff";


type EdgeMetadata = {
  connectionCountByNode: Map<string, number>;
  edgePairCounts: Map<string, number>;
};

type RenderGraphParams = {
  context: CanvasRenderingContext2D;
  edgePairCounts: Map<string, number>;
  edges: GraphEdge[];
  focus: FocusState;
  height: number;
  hoveredNode: GraphNode | null;
  hoveredNodeId?: string | null;
  labelBackground: string;
  labelZoomThresholds: Map<string, number>;
  pixelRatio: number;
  selectedNodeId?: string | null;
  textColor: string;
  transform: d3.ZoomTransform;
  visibleEdgeIds: Set<string>;
  visibleNodeIds: Set<string>;
  width: number;
  nodes: GraphNode[];
  hoveredEdgeIds?: Set<string>;
};

export function createGraphNodes(nodes: GraphNode[]) {
  return nodes.map((node) => ({ ...node, id: node.fqdn })) as GraphNode[];
}

export function createGraphEdges(edges: GraphEdge[], nodeIds: Set<string>) {
  return edges
    .filter((edge) => nodeIds.has(edge.source_fqdn) && nodeIds.has(edge.target_fqdn))
    .map(
      (edge) =>
        ({
          ...edge,
          source: edge.source_fqdn,
          target: edge.target_fqdn,
        }) satisfies GraphEdge,
    );
}

export function buildEdgeMetadata(edges: GraphEdge[]): EdgeMetadata {
  const edgePairCounts = new Map<string, number>();
  const connectionCountByNode = new Map<string, number>();

  for (const edge of edges) {
    const key = ToEdgeKey(edge.source_fqdn, edge.target_fqdn);
    const seenCount = Math.max(edge.seen_count ?? 1, 1);

    edgePairCounts.set(key, (edgePairCounts.get(key) ?? 0) + 1);
    connectionCountByNode.set(
      edge.source_fqdn,
      (connectionCountByNode.get(edge.source_fqdn) ?? 0) + seenCount,
    );
    connectionCountByNode.set(
      edge.target_fqdn,
      (connectionCountByNode.get(edge.target_fqdn) ?? 0) + seenCount,
    );
  }

  return { connectionCountByNode, edgePairCounts };
}

export function renderGraph({
  context,
  edgePairCounts,
  edges,
  focus,
  height,
  hoveredEdgeIds,
  hoveredNode,
  hoveredNodeId,
  labelBackground,
  labelZoomThresholds,
  nodes,
  pixelRatio,
  selectedNodeId,
  textColor,
  transform,
  visibleEdgeIds,
  visibleNodeIds,
  width,
}: RenderGraphParams) {
  context.save();
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.setTransform(
    pixelRatio * transform.k,
    0,
    0,
    pixelRatio * transform.k,
    pixelRatio * transform.x,
    pixelRatio * transform.y,
  );

  drawEdges(context, {
    edgePairCounts,
    edges,
    focus,
    hoveredEdgeIds,
    nodes,
    visibleEdgeIds,
    visibleNodeIds,
  });
  drawNodes(context, {
    focus,
    hoveredNode,
    hoveredNodeId,
    nodes,
    selectedNodeId,
    visibleNodeIds,
  });
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawLabels(context, {
    focus,
    hoveredNode,
    hoveredNodeId,
    labelBackground,
    labelZoomThresholds,
    nodes,
    selectedNodeId,
    textColor,
    transform,
    visibleNodeIds,
  });

  context.restore();
}

export function findVisibleNodeAt({
  point,
  simulation,
  transform,
  visibleNodeIds,
}: {
  point: [number, number];
  simulation: d3.Simulation<GraphNode, undefined>;
  transform: d3.ZoomTransform;
  visibleNodeIds: Set<string>;
}) {
  const [x, y] = transform.invert(point);
  const node = simulation.find(x, y, NODE_HIT_RADIUS / transform.k);

  return node && isNodeVisible(node, visibleNodeIds) ? node : null;
}

export function getNode(nodes: GraphNode[], node: string | number | GraphNode | undefined): GraphNode {
  if (typeof node === "object" && node !== null) return node;
  return nodes.find((candidate) => candidate.id === String(node)) ?? nodes[0];
}

export function edgesConnectedTo(edges: GraphEdge[], nodes: GraphNode[], node: GraphNode) {
  return edges.filter((edge) => {
    const source = getNode(nodes, edge.source);
    const target = getNode(nodes, edge.target);
    return source.fqdn === node.fqdn || target.fqdn === node.fqdn;
  });
}

export function edgeConnectionIds(edge: GraphEdge) {
  return [edge.id];
}

export function getFocusState({
  edges,
  hoveredEdgeIds,
  hoveredNode,
  hoveredNodeId,
  nodes,
  selectedNodeId,
  visibleEdgeIds,
  visibleNodeIds,
}: {
  edges: GraphEdge[];
  hoveredEdgeIds?: Set<string>;
  hoveredNode: GraphNode | null;
  hoveredNodeId?: string | null;
  nodes: GraphNode[];
  selectedNodeId?: string | null;
  visibleEdgeIds: Set<string>;
  visibleNodeIds: Set<string>;
}): FocusState {
  const activeNodeId = hoveredNode?.fqdn ?? hoveredNodeId ?? selectedNodeId ?? null;
  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>();

  if (activeNodeId) {
    nodeIds.add(activeNodeId);

    for (const edge of edges) {
      if (!isEdgeVisible(edge, nodes, visibleEdgeIds, visibleNodeIds)) continue;

      const source = getNode(nodes, edge.source);
      const target = getNode(nodes, edge.target);

      if (source.fqdn === activeNodeId || target.fqdn === activeNodeId) {
        edgeIds.add(edge.id);
        nodeIds.add(source.fqdn);
        nodeIds.add(target.fqdn);
      }
    }
  }

  if (hoveredEdgeIds && hoveredEdgeIds.size > 0) {
    for (const edge of edges) {
      if (
        !isEdgeVisible(edge, nodes, visibleEdgeIds, visibleNodeIds) ||
        !hoveredEdgeIds.has(edge.id)
      ) {
        continue;
      }

      const source = getNode(nodes, edge.source);
      const target = getNode(nodes, edge.target);

      edgeIds.add(edge.id);
      nodeIds.add(source.fqdn);
      nodeIds.add(target.fqdn);
    }
  }

  return {
    edgeIds,
    nodeIds,
    isActive: edgeIds.size > 0 || nodeIds.size > 0,
  };
}

export function buildLabelZoomThresholds(
  nodes: GraphNode[],
  connectionCountByNode: Map<string, number>,
) {
  const scoredNodes = nodes
    .map((node) => ({
      fqdn: node.fqdn,
      score: getNodeImportanceScore(node, connectionCountByNode),
    }))
    .sort((a, b) => a.score - b.score || a.fqdn.localeCompare(b.fqdn));

  const thresholds = new Map<string, number>();

  if (scoredNodes.length === 0) {
    return thresholds;
  }

  if (scoredNodes.length === 1) {
    thresholds.set(scoredNodes[0].fqdn, LABEL_MIN_VISIBILITY_ZOOM);
    return thresholds;
  }

  const denominator = scoredNodes.length - 1;

  for (const [index, node] of scoredNodes.entries()) {
    const importanceRank = index / denominator;
    const zoomThreshold =
      LABEL_FULL_VISIBILITY_ZOOM -
      importanceRank * (LABEL_FULL_VISIBILITY_ZOOM - LABEL_MIN_VISIBILITY_ZOOM);

    thresholds.set(node.fqdn, zoomThreshold);
  }

  return thresholds;
}

function drawEdges(
  context: CanvasRenderingContext2D,
  {
    edgePairCounts,
    edges,
    focus,
    hoveredEdgeIds,
    nodes,
    visibleEdgeIds,
    visibleNodeIds,
  }: {
    edgePairCounts: Map<string, number>;
    edges: GraphEdge[];
    focus: FocusState;
    hoveredEdgeIds?: Set<string>;
    nodes: GraphNode[];
    visibleEdgeIds: Set<string>;
    visibleNodeIds: Set<string>;
  },
) {
  const hasHoveredEdge = (hoveredEdgeIds?.size ?? 0) > 0;

  function getEdgeStyle(edge: GraphEdge): { color: string; width: number; priority: number } {
    const highlighted = isEdgeHighlighted(edge, hoveredEdgeIds);
    const focused = !focus.isActive || focus.edgeIds.has(edge.id);

    if (highlighted) {
      return { color: HIGHLIGHT_COLOR, width: EDGE_WIDTH * 1.8, priority: 2 };
    }
    if (focus.isActive && focused) {
      return {
        color: hasHoveredEdge ? DEFAULT_EDGE_COLOR : HIGHLIGHT_COLOR,
        width: EDGE_WIDTH * 1.2,
        priority: hasHoveredEdge ? 0 : 1,
      };
    }
    if (focused) {
      return { color: DEFAULT_EDGE_COLOR, width: EDGE_WIDTH * 1.2, priority: 0 };
    }
    return { color: DIMMED_COLOR, width: EDGE_WIDTH, priority: -1 };
  }

  type EdgeBucket = { edge: GraphEdge; source: GraphNode; target: GraphNode };
  const buckets = new Map<string, { color: string; width: number; priority: number; edges: EdgeBucket[] }>();

  for (const edge of edges) {
    if (!isEdgeVisible(edge, nodes, visibleEdgeIds, visibleNodeIds)) continue;

    const source = getNode(nodes, edge.source);
    const target = getNode(nodes, edge.target);
    const { color, width, priority } = getEdgeStyle(edge);
    const key = `${priority}:${color}:${width}`;

    if (!buckets.has(key)) {
      buckets.set(key, { color, width, priority, edges: [] });
    }
    buckets.get(key)!.edges.push({ edge, source, target });
  }

  const sortedBuckets = [...buckets.values()].sort((a, b) => a.priority - b.priority);

  context.save();

  for (const bucket of sortedBuckets) {
    context.strokeStyle = bucket.color;
    context.lineWidth = bucket.width;
    for (const { source, target } of bucket.edges) {
      drawEdgePath(context, source, target, edgePairCounts);
      context.stroke();
      drawArrowHead(context, source, target, edgePairCounts);
    }
  }

  context.restore();
}

function drawNodes(
  context: CanvasRenderingContext2D,
  {
    focus,
    hoveredNode,
    hoveredNodeId,
    nodes,
    selectedNodeId,
    visibleNodeIds,
  }: {
    focus: FocusState;
    hoveredNode: GraphNode | null;
    hoveredNodeId?: string | null;
    nodes: GraphNode[];
    selectedNodeId?: string | null;
    visibleNodeIds: Set<string>;
  },
) {
  for (const node of nodes) {
    if (!isNodeVisible(node, visibleNodeIds)) continue;

    const highlighted =
      node.fqdn === hoveredNodeId ||
      node.fqdn === hoveredNode?.fqdn ||
      node.fqdn === selectedNodeId;
    const focused = !focus.isActive || focus.nodeIds.has(node.fqdn);

    context.beginPath();
    context.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
    context.fillStyle = highlighted
      ? HIGHLIGHT_COLOR
      : focused
        ? fqdnToColor(node.fqdn)
        : DIMMED_COLOR;
    context.fill();

    if (highlighted) {
      context.lineWidth = 2;
      context.strokeStyle = HIGHLIGHT_COLOR;
      context.stroke();
    }
  }
}

function drawLabels(
  context: CanvasRenderingContext2D,
  {
    focus,
    hoveredNode,
    hoveredNodeId,
    labelBackground,
    labelZoomThresholds,
    nodes,
    selectedNodeId,
    textColor,
    transform,
    visibleNodeIds,
  }: {
    focus: FocusState;
    hoveredNode: GraphNode | null;
    hoveredNodeId?: string | null;
    labelBackground: string;
    labelZoomThresholds: Map<string, number>;
    nodes: GraphNode[];
    selectedNodeId?: string | null;
    textColor: string;
    transform: d3.ZoomTransform;
    visibleNodeIds: Set<string>;
  },
) {
  context.save();
  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.font = `700 ${LABEL_FONT_SIZE}px Inter, system-ui, sans-serif`;

  for (const node of nodes) {
    if (!isNodeVisible(node, visibleNodeIds)) continue;
    if (
      !shouldDrawLabel({
        hoveredNode,
        hoveredNodeId,
        labelZoomThresholds,
        node,
        selectedNodeId,
        transform,
      })
    ) {
      continue;
    }

    const x = transform.applyX(node.x);
    const y = transform.applyY(node.y);
    const labelY = y - NODE_RADIUS * transform.k - LABEL_NODE_GAP;

    context.lineWidth = LABEL_STROKE_WIDTH;
    context.strokeStyle =
      !focus.isActive || focus.nodeIds.has(node.fqdn) ? labelBackground : DIMMED_TEXT_COLOR;
    context.strokeText(node.fqdn, x, labelY);
    context.fillStyle =
      !focus.isActive || focus.nodeIds.has(node.fqdn) ? textColor : DIMMED_TEXT_COLOR;
    context.fillText(node.fqdn, x, labelY);
  }

  context.restore();
}

function shouldDrawLabel({
  hoveredNode,
  hoveredNodeId,
  labelZoomThresholds,
  node,
  selectedNodeId,
  transform,
}: {
  hoveredNode: GraphNode | null;
  hoveredNodeId?: string | null;
  labelZoomThresholds: Map<string, number>;
  node: GraphNode;
  selectedNodeId?: string | null;
  transform: d3.ZoomTransform;
}) {
  if (transform.k < LABEL_MIN_VISIBILITY_ZOOM) {
    return false;
  }

  if (
    node.fqdn === hoveredNode?.fqdn ||
    node.fqdn === hoveredNodeId ||
    node.fqdn === selectedNodeId
  ) {
    return true;
  }

  return transform.k >= (labelZoomThresholds.get(node.fqdn) ?? LABEL_FULL_VISIBILITY_ZOOM);
}

function drawEdgePath(
  context: CanvasRenderingContext2D,
  source: GraphNode,
  target: GraphNode,
  edgePairCounts: Map<string, number>,
) {
  context.beginPath();
  context.moveTo(source.x, source.y);

  const controlPoint = getEdgeControlPoint(source, target, edgePairCounts);

  if (!controlPoint) {
    context.lineTo(target.x, target.y);
    return;
  }

  context.quadraticCurveTo(controlPoint.x, controlPoint.y, target.x, target.y);
}

function drawArrowHead(
  context: CanvasRenderingContext2D,
  source: GraphNode,
  target: GraphNode,
  edgePairCounts: Map<string, number>,
) {
  const { x, y, angle } = getArrowHeadGeometry(source, target, edgePairCounts);

  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-ARROW_HEAD_LENGTH, -ARROW_HEAD_WIDTH / 2);
  context.lineTo(-ARROW_HEAD_LENGTH, ARROW_HEAD_WIDTH / 2);
  context.closePath();
  context.fillStyle = context.strokeStyle;
  context.fill();
  context.restore();
}

function getArrowHeadGeometry(source: GraphNode, target: GraphNode, edgePairCounts: Map<string, number>) {
  const controlPoint = getEdgeControlPoint(source, target, edgePairCounts);
  let tangentX = target.x - source.x;
  let tangentY = target.y - source.y;

  if (controlPoint) {
    tangentX = target.x - controlPoint.x;
    tangentY = target.y - controlPoint.y;
  }

  const tangentLength = Math.hypot(tangentX, tangentY) || 1;
  const unitX = tangentX / tangentLength;
  const unitY = tangentY / tangentLength;
  const tipOffset = NODE_RADIUS;

  return {
    x: target.x - unitX * tipOffset,
    y: target.y - unitY * tipOffset,
    angle: Math.atan2(unitY, unitX),
  };
}

function getEdgeControlPoint(source: GraphNode, target: GraphNode, edgePairCounts: Map<string, number>) {
  const pairKey = ToEdgeKey(source.fqdn, target.fqdn);
  const reverse_pairKey = ToEdgeKey(target.fqdn, source.fqdn);
  if ((edgePairCounts.get(reverse_pairKey) ?? 0) < 1 || (edgePairCounts.get(pairKey) ?? 0) < 1) {
    return null;
  }

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy) || 1;
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const curveAmount = Math.min(distance * 0.25, 80);
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;

  return {
    x: midX + normalX * curveAmount,
    y: midY + normalY * curveAmount,
  };
}

function isNodeVisible(node: GraphNode, visibleNodeIds: Set<string>) {
  return visibleNodeIds.has(node.fqdn);
}

function isEdgeVisible(
  edge: GraphEdge,
  nodes: GraphNode[],
  visibleEdgeIds: Set<string>,
  visibleNodeIds: Set<string>,
) {
  return (
    isNodeVisible(getNode(nodes, edge.source), visibleNodeIds) &&
    isNodeVisible(getNode(nodes, edge.target), visibleNodeIds) &&
    visibleEdgeIds.has(edge.id)
  );
}

function isEdgeHighlighted(edge: GraphEdge, hoveredEdgeIds?: Set<string>) {
  return hoveredEdgeIds?.has(edge.id) ?? false;
}

function ToEdgeKey(a: string, b: string) {
  return `${a}->${b}`;
}

function getNodeImportanceScore(node: GraphNode, connectionCountByNode: Map<string, number>) {
  return Math.max(
    node.connection_count ?? 0,
    connectionCountByNode.get(node.fqdn) ?? 0,
    node.distinct_edge ?? 0,
  );
}

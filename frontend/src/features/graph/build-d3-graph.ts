import type { GraphEdge, GraphNode } from "@/features/graph/types";
import { fqdnToColor } from "@/lib/cssVarColor";
import * as d3 from "d3";

export type D3Node = GraphNode &
  d3.SimulationNodeDatum & {
    id: string;
    x: number;
    y: number;
    fx: number | null;
    fy: number | null;
  };

export type D3Edge = d3.SimulationLinkDatum<D3Node> & GraphEdge;

export type CanvasDragSubject = {
  node: D3Node;
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
const ARROW_HEAD_WIDTH = 3;
const LABEL_FONT_SIZE = 12;
const LABEL_STROKE_WIDTH = 4;
const LABEL_NODE_GAP = 10;
const LABEL_FULL_VISIBILITY_ZOOM = 2.1;
const LABEL_MIN_VISIBILITY_ZOOM = 0.3;
const DIMMED_COLOR = "rgba(148, 163, 184, 1)";
const DIMMED_TEXT_COLOR = "rgba(148, 163, 184, 0.0)";
const DEFAULT_EDGE_COLOR = "rgba(148, 163, 184, 1)";
const HIGHLIGHT_COLOR = "#ff2ad4";


type EdgeMetadata = {
  connectionCountByNode: Map<string, number>;
  edgePairCounts: Map<string, number>;
};

type RenderGraphParams = {
  context: CanvasRenderingContext2D;
  edgePairCounts: Map<string, number>;
  edges: D3Edge[];
  focus: FocusState;
  height: number;
  hoveredNode: D3Node | null;
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
  nodes: D3Node[];
  hoveredEdgeIds?: Set<string>;
};

export function createD3Nodes(nodes: GraphNode[]) {
  return nodes.map((node) => ({ ...node, id: node.fqdn })) as D3Node[];
}

export function createD3Edges(edges: GraphEdge[], nodeIds: Set<string>) {
  return edges
    .filter((edge) => nodeIds.has(edge.source_fqdn) && nodeIds.has(edge.target_fqdn))
    .map(
      (edge) =>
        ({
          ...edge,
          source: edge.source_fqdn,
          target: edge.target_fqdn,
        }) satisfies D3Edge,
    );
}

export function buildEdgeMetadata(edges: D3Edge[]): EdgeMetadata {
  const edgePairCounts = new Map<string, number>();
  const connectionCountByNode = new Map<string, number>();

  for (const edge of edges) {
    const key = unorderedEdgeKey(edge.source_fqdn, edge.target_fqdn);
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
  simulation: d3.Simulation<D3Node, undefined>;
  transform: d3.ZoomTransform;
  visibleNodeIds: Set<string>;
}) {
  const [x, y] = transform.invert(point);
  const node = simulation.find(x, y, NODE_HIT_RADIUS / transform.k);

  return node && isNodeVisible(node, visibleNodeIds) ? node : null;
}

export function getNode(nodes: D3Node[], node: string | number | D3Node | undefined): D3Node {
  if (typeof node === "object" && node !== null) return node;
  return nodes.find((candidate) => candidate.id === String(node)) ?? nodes[0];
}

export function edgesConnectedTo(edges: D3Edge[], nodes: D3Node[], node: D3Node) {
  return edges.filter((edge) => {
    const source = getNode(nodes, edge.source);
    const target = getNode(nodes, edge.target);
    return source.fqdn === node.fqdn || target.fqdn === node.fqdn;
  });
}

export function edgeConnectionIds(edge: D3Edge) {
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
  edges: D3Edge[];
  hoveredEdgeIds?: Set<string>;
  hoveredNode: D3Node | null;
  hoveredNodeId?: string | null;
  nodes: D3Node[];
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
  nodes: D3Node[],
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
    edges: D3Edge[];
    focus: FocusState;
    hoveredEdgeIds?: Set<string>;
    nodes: D3Node[];
    visibleEdgeIds: Set<string>;
    visibleNodeIds: Set<string>;
  },
) {
  context.save();
  context.strokeStyle = DEFAULT_EDGE_COLOR;
  context.lineWidth = EDGE_WIDTH;

  for (const edge of edges) {
    if (!isEdgeVisible(edge, nodes, visibleEdgeIds, visibleNodeIds)) continue;

    const source = getNode(nodes, edge.source);
    const target = getNode(nodes, edge.target);
    const highlighted = isEdgeHighlighted(edge, hoveredEdgeIds);
    const focused = !focus.isActive || focus.edgeIds.has(edge.id);

    context.strokeStyle =
      highlighted || (focus.isActive && focused)
        ? HIGHLIGHT_COLOR
        : focused
          ? DEFAULT_EDGE_COLOR
          : DIMMED_COLOR;
    context.lineWidth = highlighted || focused ? EDGE_WIDTH * 1.8 : EDGE_WIDTH;
    drawEdgePath(context, source, target, edgePairCounts);
    context.stroke();
    drawArrowHead(context, source, target, edgePairCounts);
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
    hoveredNode: D3Node | null;
    hoveredNodeId?: string | null;
    nodes: D3Node[];
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
    hoveredNode: D3Node | null;
    hoveredNodeId?: string | null;
    labelBackground: string;
    labelZoomThresholds: Map<string, number>;
    nodes: D3Node[];
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
  hoveredNode: D3Node | null;
  hoveredNodeId?: string | null;
  labelZoomThresholds: Map<string, number>;
  node: D3Node;
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
  source: D3Node,
  target: D3Node,
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
  source: D3Node,
  target: D3Node,
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

function getArrowHeadGeometry(source: D3Node, target: D3Node, edgePairCounts: Map<string, number>) {
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
  const tipOffset = NODE_RADIUS + 1;

  return {
    x: target.x - unitX * tipOffset,
    y: target.y - unitY * tipOffset,
    angle: Math.atan2(unitY, unitX),
  };
}

function getEdgeControlPoint(source: D3Node, target: D3Node, edgePairCounts: Map<string, number>) {
  const pairKey = unorderedEdgeKey(source.fqdn, target.fqdn);
  const hasParallelOrReverse = (edgePairCounts.get(pairKey) ?? 0) > 1;

  if (!hasParallelOrReverse) {
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

function isNodeVisible(node: D3Node, visibleNodeIds: Set<string>) {
  return visibleNodeIds.size === 0 || visibleNodeIds.has(node.fqdn);
}

function isEdgeVisible(
  edge: D3Edge,
  nodes: D3Node[],
  visibleEdgeIds: Set<string>,
  visibleNodeIds: Set<string>,
) {
  return (
    isNodeVisible(getNode(nodes, edge.source), visibleNodeIds) &&
    isNodeVisible(getNode(nodes, edge.target), visibleNodeIds) &&
    (visibleEdgeIds.size === 0 || visibleEdgeIds.has(edge.id))
  );
}

function isEdgeHighlighted(edge: D3Edge, hoveredEdgeIds?: Set<string>) {
  return hoveredEdgeIds?.has(edge.id) ?? false;
}

function unorderedEdgeKey(a: string, b: string) {
  return a < b ? `${a}->${b}` : `${b}->${a}`;
}

function getNodeImportanceScore(node: D3Node, connectionCountByNode: Map<string, number>) {
  return Math.max(
    node.connection_count ?? 0,
    connectionCountByNode.get(node.fqdn) ?? 0,
    node.distinct_edge ?? 0,
  );
}

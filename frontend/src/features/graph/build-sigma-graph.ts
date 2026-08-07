import type { GraphNode, GraphSnapshot } from "@/features/graph/types"
import { fqdnToColor } from "@/lib/cssVarColor"
import * as d3 from "d3"
import Graph from "graphology"

type ForceNode = {
  fqdn: string
  x: number
  y: number
  vx?: number
  vy?: number
}

type ForceEdge = {
  source: string
  target: string
}

type GroupedEdge = {
  key: string
  source: string
  target: string
  connectionIds: string[]
  seenCount: number
}

export type SigmaNodeAttributes = {
  fqdn: string
  label: string
  color: string
  size: number
  x: number
  y: number
}

export type SigmaEdgeAttributes = {
  key: string
  sourceFqdn: string
  targetFqdn: string
  connectionIds: string[]
  color: string
  size: number
  curvature: number
  type: "curved" | "arrow"
}

export type SigmaGraphBuildResult = {
  graph: Graph<SigmaNodeAttributes, SigmaEdgeAttributes>
  signature: string
  nodeToConnectionIds: Map<string, string[]>
  groupedEdgeToConnectionIds: Map<string, string[]>
  connectionToGroupedEdge: Map<string, string>
  groupedEdges: GroupedEdge[]
  nextPositions: Map<string, { x: number; y: number }>
}

const BASE_EDGE_COLOR = "rgba(148, 163, 184, 1)"

export function buildSigmaGraph({
  graphData,
  visibleNodeIds,
  visibleEdgeIds,
  previousPositions,
}: {
  graphData: GraphSnapshot
  visibleNodeIds: Set<string>
  visibleEdgeIds: Set<string>
  previousPositions?: Map<string, { x: number; y: number }>
}): SigmaGraphBuildResult {
  const visibleNodes = graphData.nodes.filter((node) => visibleNodeIds.has(node.fqdn))
  const nodeByFqdn = new Map(visibleNodes.map((node) => [node.fqdn, node]))

  const grouped = new Map<string, GroupedEdge>()

  for (const edge of graphData.edges) {
    if (!visibleEdgeIds.has(edge.id)) continue
    if (!nodeByFqdn.has(edge.source_fqdn) || !nodeByFqdn.has(edge.target_fqdn)) continue

    const key = toDirectedPairKey(edge.source_fqdn, edge.target_fqdn)
    const existing = grouped.get(key)
    if (existing) {
      existing.connectionIds.push(edge.id)
      existing.seenCount += Math.max(edge.seen_count ?? 1, 1)
      continue
    }

    grouped.set(key, {
      key,
      source: edge.source_fqdn,
      target: edge.target_fqdn,
      connectionIds: [edge.id],
      seenCount: Math.max(edge.seen_count ?? 1, 1),
    })
  }

  const groupedEdges = [...grouped.values()]

  const forceNodes = seedNodes(visibleNodes, previousPositions ?? new Map())
  runForceLayout(forceNodes, groupedEdges)

  const nextPositions = new Map<string, { x: number; y: number }>()
  for (const node of forceNodes) {
    nextPositions.set(node.fqdn, {
      x: Number.isFinite(node.x) ? node.x : 0,
      y: Number.isFinite(node.y) ? node.y : 0,
    })
  }

  const nodeToConnectionIds = new Map<string, string[]>()
  const groupedEdgeToConnectionIds = new Map<string, string[]>()
  const connectionToGroupedEdge = new Map<string, string>()

  for (const edge of groupedEdges) {
    groupedEdgeToConnectionIds.set(edge.key, edge.connectionIds)
    for (const connectionId of edge.connectionIds) {
      connectionToGroupedEdge.set(connectionId, edge.key)
    }

    if (!nodeToConnectionIds.has(edge.source)) nodeToConnectionIds.set(edge.source, [])
    if (!nodeToConnectionIds.has(edge.target)) nodeToConnectionIds.set(edge.target, [])

    nodeToConnectionIds.get(edge.source)!.push(...edge.connectionIds)
    nodeToConnectionIds.get(edge.target)!.push(...edge.connectionIds)
  }

  const graph = new Graph<SigmaNodeAttributes, SigmaEdgeAttributes>({
    type: "directed",
    multi: true,
    allowSelfLoops: true,
  })

  for (const node of visibleNodes) {
    const position = nextPositions.get(node.fqdn) ?? { x: 0, y: 0 }

    graph.addNode(node.fqdn, {
      fqdn: node.fqdn,
      label: node.fqdn,
      color: fqdnToColor(node.fqdn),
      size: node.ciid ? 13 : 10,
      x: Number.isFinite(position.x) ? position.x : 0,
      y: Number.isFinite(position.y) ? position.y : 0,
    })
  }

  for (const edge of groupedEdges) {
    const reverseKey = toDirectedPairKey(edge.target, edge.source)
    const hasReverse = grouped.has(reverseKey)
    const curvature = hasReverse ? reciprocalCurvature() : 0

    graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, {
      key: edge.key,
      sourceFqdn: edge.source,
      targetFqdn: edge.target,
      connectionIds: edge.connectionIds,
      color: BASE_EDGE_COLOR,
      size: 2,
      curvature,
      type: hasReverse ? "curved" : "arrow",
    })
  }

  const signature = [
    [...visibleNodeIds].sort().join("\n"),
    groupedEdges
      .map((edge) => `${edge.key}:${edge.seenCount}:${edge.connectionIds.length}`)
      .sort()
      .join("\n"),
  ].join("\n---\n")

  return {
    graph,
    signature,
    nodeToConnectionIds,
    groupedEdgeToConnectionIds,
    connectionToGroupedEdge,
    groupedEdges,
    nextPositions,
  }
}

function seedNodes(
  nodes: GraphNode[],
  previousPositions: Map<string, { x: number; y: number }>,
): ForceNode[] {
  const radius = Math.max(40, Math.sqrt(nodes.length) * 18)

  return nodes.map((node, index) => {
    const previous = previousPositions.get(node.fqdn)
    if (previous) {
      return { fqdn: node.fqdn, x: previous.x, y: previous.y }
    }

    const hash = hashString(node.fqdn)
    const angle = ((hash % 360) * Math.PI) / 180 + index * 0.05
    const distance = radius + ((hash >>> 9) % 16)

    return {
      fqdn: node.fqdn,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    }
  })
}

function runForceLayout(nodes: ForceNode[], groupedEdges: GroupedEdge[]) {
  if (nodes.length < 2) return

  const links: ForceEdge[] = groupedEdges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }))

  const simulation = d3
    .forceSimulation<ForceNode>(nodes)
    .force(
      "link",
      d3
        .forceLink<ForceNode, ForceEdge>(links)
        .id((node) => node.fqdn)
        .distance(10)
        .strength(1),
    )
    .force("charge", d3.forceManyBody().strength(-50).distanceMax(600))
    .force("x", d3.forceX(0).strength(0.04))
    .force("y", d3.forceY(0).strength(0.04))
    .force("center", d3.forceCenter(0, 0).strength(0.05))
    .stop()

  const ticks = Math.min(140, Math.max(60, Math.round(nodes.length * 0.8)))
  for (let i = 0; i < ticks; i += 1) simulation.tick()
  simulation.stop()
}

function reciprocalCurvature() {
  return 0.22;
}

function toDirectedPairKey(source: string, target: string) {
  return `${source}=>${target}`
}

function hashString(input: string) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}



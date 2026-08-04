import { useEffect, useMemo, useRef } from "react"
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
} from "@react-sigma/core"
import { EdgeCurvedArrowProgram } from "@sigma/edge-curve"
import "@react-sigma/core/lib/style.css"

import { buildSigmaGraph } from "@/features/graph/build-sigma-graph"
import type { GraphViewProps } from "@/features/graph/graph-view-types"
import { cssVarColor } from "@/lib/cssVarColor"

const HIGHLIGHT_COLOR = "#ff88ff"
const DIMMED_EDGE_COLOR = "rgba(148, 163, 184, 0.18)"
const DEFAULT_EDGE_COLOR = "rgba(148, 163, 184, 0.5)"
const DIMMED_NODE_COLOR = "rgba(148, 163, 184, 1)"

const SIGMA_ZOOM_MIN = 0.02
const SIGMA_ZOOM_MAX = 12

export default function GraphViewSigma(props: GraphViewProps) {
  const graphData = props.graphData
  const previousPositionsRef = useRef(new Map<string, { x: number; y: number }>())
  const previousBuildRef = useRef<ReturnType<typeof buildSigmaGraph> | null>(null)
  const labelColor = useMemo(() => {
    try {
      return cssVarColor("--foreground")
    } catch {
      return "#e5e7eb"
    }
  }, [])

  const sigmaSettings = useMemo(
    () => ({
      autoRescale: true,
      defaultEdgeType: "arrow" as const,
      defaultDrawNodeHover: () => {},
      edgeProgramClasses: { curved: EdgeCurvedArrowProgram },
      enableEdgeEvents: false,
      hideEdgesOnMove: false,
      hideLabelsOnMove: false,
      labelColor: { color: labelColor },
      labelRenderedSizeThreshold: 7,
      labelSize: 13,
      labelWeight: "500",
      maxCameraRatio: SIGMA_ZOOM_MAX,
      minCameraRatio: SIGMA_ZOOM_MIN,
      renderEdgeLabels: false,
      renderLabels: true,
    }),
    [labelColor],
  )

  const buildSignature = useMemo(() => {
    if (!graphData) return ""

    const visibleNodesKey = [...props.visibleNodeIds].sort().join("\n")
    const grouped = new Map<string, { seenCount: number; connectionCount: number }>()

    for (const edge of graphData.edges) {
      if (!props.visibleEdgeIds.has(edge.id)) continue
      if (!props.visibleNodeIds.has(edge.source_fqdn) || !props.visibleNodeIds.has(edge.target_fqdn)) {
        continue
      }

      const key = `${edge.source_fqdn}=>${edge.target_fqdn}`
      const seen = Math.max(edge.seen_count ?? 1, 1)
      const existing = grouped.get(key)

      if (existing) {
        existing.seenCount += seen
        existing.connectionCount += 1
      } else {
        grouped.set(key, { seenCount: seen, connectionCount: 1 })
      }
    }

    const groupedEdgesKey = [...grouped.entries()]
      .map(([key, value]) => `${key}:${value.seenCount}:${value.connectionCount}`)
      .sort()
      .join("\n")

    return [visibleNodesKey, groupedEdgesKey].join("\n---\n")
  }, [graphData, props.visibleEdgeIds, props.visibleNodeIds])

  const build = useMemo(() => {
    if (!graphData) return null

    const previousBuild = previousBuildRef.current
    if (previousBuild && previousBuild.signature === buildSignature) {
      return previousBuild
    }

    const nextBuild = buildSigmaGraph({
      graphData,
      visibleEdgeIds: props.visibleEdgeIds,
      visibleNodeIds: props.visibleNodeIds,
      previousPositions: previousPositionsRef.current,
    })

    previousBuildRef.current = nextBuild
    previousPositionsRef.current = nextBuild.nextPositions
    return nextBuild
  }, [buildSignature, graphData, props.visibleEdgeIds, props.visibleNodeIds])

  if (!build) {
    return (
      <div
        aria-label="Sigma force-directed graph"
        className="absolute inset-0"
        role="img"
      />
    )
  }

  return (
    <SigmaContainer
      className="absolute inset-0"
      settings={sigmaSettings}
      style={{ height: "100%", width: "100%", background: "transparent" }}
    >
      <SigmaBindings build={build} props={props} />
    </SigmaContainer>
  )
}

function SigmaBindings({
  build,
  props,
}: {
  build: ReturnType<typeof buildSigmaGraph>
  props: GraphViewProps
}) {
  const sigma = useSigma()
  const loadGraph = useLoadGraph()
  const registerEvents = useRegisterEvents()

  const hoveredNodeRef = useRef<string | null>(null)
  const latestRef = useRef(props)

  useEffect(() => {
    latestRef.current = props
  }, [props])

  const focus = useMemo(() => {
    const activeEdgeIds = new Set<string>()
    const activeNodeIds = new Set<string>()

    if (props.hoveredEdgeIds?.size) {
      for (const connectionId of props.hoveredEdgeIds) {
        const groupedEdge = build.connectionToGroupedEdge.get(connectionId)
        if (groupedEdge) activeEdgeIds.add(groupedEdge)
      }
    }

    if (props.hoveredNodeId) {
      activeNodeIds.add(props.hoveredNodeId)
      const connected = build.nodeToConnectionIds.get(props.hoveredNodeId) ?? []
      for (const connectionId of connected) {
        const groupedEdge = build.connectionToGroupedEdge.get(connectionId)
        if (groupedEdge) activeEdgeIds.add(groupedEdge)
      }
    }

    if (props.selectedNodeId) {
      activeNodeIds.add(props.selectedNodeId)
      const connected = build.nodeToConnectionIds.get(props.selectedNodeId) ?? []
      for (const connectionId of connected) {
        const groupedEdge = build.connectionToGroupedEdge.get(connectionId)
        if (groupedEdge) activeEdgeIds.add(groupedEdge)
      }
    }

    for (const groupedEdge of activeEdgeIds) {
      const edge = build.groupedEdges.find((item) => item.key === groupedEdge)
      if (!edge) continue
      activeNodeIds.add(edge.source)
      activeNodeIds.add(edge.target)
    }

    const isActive = activeEdgeIds.size > 0 || activeNodeIds.size > 0
    return { activeEdgeIds, activeNodeIds, isActive }
  }, [build, props.hoveredEdgeIds, props.hoveredNodeId, props.selectedNodeId])

  useEffect(() => {
    loadGraph(build.graph, true)
  }, [build, loadGraph])

  useEffect(() => {
    sigma.setSetting("nodeReducer", (node, data) => {
      const x = Number.isFinite(data.x) ? data.x : 0
      const y = Number.isFinite(data.y) ? data.y : 0
      const label = typeof data.label === "string" ? data.label : node

      if (!latestRef.current.visibleNodeIds.has(node)) {
        return {
          hidden: true,
          label,
          size: data.size,
          x,
          y,
        }
      }

      const highlighted = focus.activeNodeIds.has(node)
      if (!focus.isActive) {
        return {
          color: data.color,
          hidden: false,
          label,
          size: data.size,
          x,
          y,
        }
      }

      if (highlighted) {
        return {
          color: HIGHLIGHT_COLOR,
          hidden: false,
          label,
          size: data.size,
          x,
          y,
          zIndex: 10,
        }
      }

      return {
        color: DIMMED_NODE_COLOR,
        hidden: false,
        label,
        size: data.size,
        x,
        y,
      }
    })

    sigma.setSetting("edgeReducer", (edge) => {
      const edgeData = sigma.getGraph().getEdgeAttributes(edge) as {
        curvature?: number
        type?: string
        size: number
      }

      if (!focus.isActive) {
        return {
          color: DEFAULT_EDGE_COLOR,
          curvature: edgeData.curvature ?? 0,
          hidden: false,
          size: edgeData.size,
          type: edgeData.type ?? "arrow",
        }
      }

      const highlighted = focus.activeEdgeIds.has(edge)
      if (highlighted) {
        return {
          color: HIGHLIGHT_COLOR,
          curvature: edgeData.curvature ?? 0,
          hidden: false,
          size: edgeData.size,
          type: edgeData.type ?? "arrow",
          zIndex: 20,
        }
      }

      return {
        color: DIMMED_EDGE_COLOR,
        curvature: edgeData.curvature ?? 0,
        hidden: false,
        size: edgeData.size,
        type: edgeData.type ?? "arrow",
      }
    })

    sigma.refresh()
  }, [focus, sigma])

  useEffect(() => {
    sigma.getContainer().style.background = "transparent"
    sigma.refresh()
  }, [sigma])

  useEffect(() => {
    registerEvents({
      clickNode: ({ node }) => {
        latestRef.current.onNodeSelect?.(node)
      },
      clickStage: () => {
        latestRef.current.onStageClick?.()
      },
      enterNode: ({ node, event }) => {
        hoveredNodeRef.current = node
        latestRef.current.onNodeHoverChange?.(node)
        const edgeIds = build.nodeToConnectionIds.get(node) ?? []
        latestRef.current.onEdgeHoverChange?.(edgeIds)
        const point = getMousePositionFromPayload(event)
        latestRef.current.onNodeHoverPositionChange?.(point)
      },
      leaveNode: ({ node }) => {
        if (hoveredNodeRef.current !== node) return
        hoveredNodeRef.current = null
        latestRef.current.onNodeHoverChange?.(null)
        latestRef.current.onEdgeHoverChange?.([])
        latestRef.current.onNodeHoverPositionChange?.(null)
      },
      updated: () => {
        // Keep tooltip anchored to pointer coordinates only.
      },
      resize: () => {
        // Keep tooltip anchored to pointer coordinates only.
      },
      mousemovebody: () => {
        // Keep tooltip fixed where the node hover started.
      },
      leaveStage: () => {
        hoveredNodeRef.current = null
        latestRef.current.onNodeHoverChange?.(null)
        latestRef.current.onEdgeHoverChange?.([])
        latestRef.current.onNodeHoverPositionChange?.(null)
      },
    })
  }, [build.nodeToConnectionIds, registerEvents, sigma])

  return null
}

function getMousePositionFromPayload(payload: unknown): { x: number; y: number } | null {
  const candidate = payload as {
    x?: number
    y?: number
    event?: { x?: number; y?: number }
  }

  const eventX = candidate.event?.x
  const eventY = candidate.event?.y

  const x = Number.isFinite(eventX) ? eventX : Number.isFinite(candidate.x) ? candidate.x : null
  const y = Number.isFinite(eventY) ? eventY : Number.isFinite(candidate.y) ? candidate.y : null

  if (x == null || y == null) return null
  return { x, y }
}

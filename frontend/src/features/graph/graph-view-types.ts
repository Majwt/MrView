import type { GraphSnapshot } from "@/features/graph/types"

export type GraphRenderer = "d3" | "sigma"

export type GraphViewProps = {
  graphData: GraphSnapshot | null
  visibleNodeIds: Set<string>
  visibleEdgeIds: Set<string>
  hoveredNodeId?: string | null
  hoveredEdgeIds?: Set<string>
  selectedNodeId?: string | null
  onEdgeHoverChange?: (edgeIds: string[]) => void
  onNodeHoverChange?: (fqdn: string | null) => void
  onNodeHoverPositionChange?: (position: { x: number; y: number } | null) => void
  onNodeSelect?: (fqdn: string) => void
  onStageClick?: () => void
}

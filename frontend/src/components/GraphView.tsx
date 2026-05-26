// src/components/GraphView.tsx

import "@react-sigma/core/lib/style.css"

import { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import { EdgeArrowProgram, type NodeHoverDrawingFunction, type NodeLabelDrawingFunction } from "sigma/rendering";
import { useEffect, useMemo, useRef, useState } from "react"
import { cssVar } from "@/lib/css-var"

import type { GraphEdge, GraphNode } from "@/features/graph/types"
import { useTheme } from "next-themes"
import { buildSigmaGraph } from "@/features/graph/build-sigma-graph"
import Sigma from "sigma"
import { forceSupervisorLayout } from "@/features/graph/force-supervisor-layout"

type GraphViewProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}


function useSigmaColors() {
  const { resolvedTheme } = useTheme()
  const [colors, setColors] = useState({
    foreground: "",
    primary: "",
    mutedForeground: "",
    border: "",
  })

  useEffect(() => {
    // wait until next-themes has applied .dark/.light to <html>
    requestAnimationFrame(() => {
      setColors({
        foreground: cssVar("--foreground"),
        primary: cssVar("--primary"),
        mutedForeground: cssVar("--muted-foreground"),
        border: cssVar("--border"),
      })
    })
  }, [resolvedTheme])

  return colors
}


export default function GraphView({ nodes, edges }: GraphViewProps) {
  const graph = useMemo(() => {
    return buildSigmaGraph(nodes, edges)
  }, [nodes, edges])
  console.log("GraphView received nodes and edges:", { nodes, edges })

  const { resolvedTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const sigmaStyle = {
    "--sigma-background-color": "var(--background)",
  } as React.CSSProperties

  const colors = useSigmaColors()

  const settings = useMemo(
    () => ({
      defaultNodeColor: colors.primary,
      defaultEdgeColor: "#cccccc",

      labelColor: {
        color: colors.foreground,
      },

      edgeLabelColor: {
        color: colors.foreground,
      },
    }),
    [colors],
  )

  useEffect(() => {
    if (!containerRef.current) return

    const renderer = new Sigma(graph, containerRef.current, {
      edgeProgramClasses: {
        straight: EdgeArrowProgram,
        curvedArrow: EdgeCurvedArrowProgram,
        curved: EdgeCurvedArrowProgram,
      },
      allowInvalidContainer: false,
      ...settings,
    })

    const cleanupLayout = forceSupervisorLayout(renderer, graph)

    return () => {
      cleanupLayout()
      renderer.kill()
    }
  }, [colors, graph, settings])

  return (
    <div ref={containerRef} className="h-full w-full">
      {/* <SigmaContainer */}
      {/*   key={resolvedTheme} // force remount on theme change to update CSS variables */}
      {/*   graph={graph} */}
      {/*   className="h-full w-full" */}
      {/*   settings={settings} */}
      {/*   style={sigmaStyle} */}
      {/* > */}
      {/* </SigmaContainer> */}
    </div>
  )
}

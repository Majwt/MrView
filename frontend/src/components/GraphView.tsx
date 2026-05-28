// src/components/GraphView.tsx

import "@react-sigma/core/lib/style.css";

import { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import { EdgeArrowProgram } from "sigma/rendering";
import { useEffect, useMemo, useRef, useState } from "react";
import { cssVarColor, cssVarColorRgba } from "@/lib/cssVarColor";

import type { GraphEdge, GraphNode } from "@/features/graph/types";
import { useTheme } from "next-themes";
import { buildSigmaGraph } from "@/features/graph/build-sigma-graph";
import Sigma from "sigma";
import { forceSupervisorLayout } from "@/features/graph/force-supervisor-layout";

type GraphViewProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

function useSigmaColors() {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState({
    foreground: "",
    primary: "",
    mutedForeground: "",
    border: "",
  });

  useEffect(() => {
    // wait until next-themes has applied .dark/.light to <html>
    requestAnimationFrame(() => {
      setColors({
        foreground: cssVarColor("--foreground"),
        primary: cssVarColor("--primary"),
        mutedForeground: cssVarColor("--muted-foreground"),
        border: cssVarColorRgba("--muted-foreground"),
      });
    });
  }, [resolvedTheme]);

  return colors;
}

export default function GraphView({ nodes, edges }: GraphViewProps) {
  const graphRef = useRef(buildSigmaGraph(nodes, edges));
  const rendererRef = useRef<Sigma | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const colors = useSigmaColors();

  const settings = useMemo(
    () => ({
      defaultNodeColor: colors.primary,
      defaultEdgeColor: colors.border,

      labelColor: {
        color: colors.foreground,
      },

      edgeLabelColor: {
        color: colors.foreground,
      },
    }),
    [colors],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const graph = graphRef.current;

    const renderer = new Sigma(graph, containerRef.current, {
      edgeProgramClasses: {
        straight: EdgeArrowProgram,
        curvedArrow: EdgeCurvedArrowProgram,
        curved: EdgeCurvedArrowProgram,
      },
      allowInvalidContainer: false,
      ...settings,
    });
    rendererRef.current = renderer;

    const cleanupLayout = forceSupervisorLayout(renderer, graph);

    return () => {
      cleanupLayout();
      renderer.kill();
      rendererRef.current = null;
    };
  }, [colors, settings]);

  return <div ref={containerRef} className="h-full w-full" />;
}

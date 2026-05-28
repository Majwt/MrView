// src/components/GraphView.tsx

import "@react-sigma/core/lib/style.css";

import { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import { EdgeArrowProgram } from "sigma/rendering";
import { useEffect, useMemo, useRef, useState } from "react";
import { cssVarColor, cssVarColorRgba } from "@/lib/cssVarColor";
import type { Attributes } from "graphology-types";
import type { EdgeDisplayData, NodeDisplayData } from "sigma/types";

import type { GraphEdge, GraphNode } from "@/features/graph/types";
import { useTheme } from "next-themes";
import { buildSigmaGraph, syncSigmaGraph } from "@/features/graph/build-sigma-graph";
import Sigma from "sigma";
import { forceSupervisorLayout } from "@/features/graph/force-supervisor-layout";

type GraphViewProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
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

export default function GraphView({ nodes, edges, visibleEdgeIds, visibleNodeIds }: GraphViewProps) {
  const graphRef = useRef(buildSigmaGraph(nodes, edges));
  const rendererRef = useRef<Sigma<Attributes, Attributes, Attributes> | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const colors = useSigmaColors();

  const settings = useMemo(
    () => ({
      defaultNodeColor: colors.primary,
      defaultEdgeColor: colors.border,
      nodeReducer: (node: string, data: Attributes): Partial<NodeDisplayData> => ({
        ...data,
        hidden: visibleNodeIds.size > 0 && !visibleNodeIds.has(node),
      }),
      edgeReducer: (_edge: string, data: Attributes): Partial<EdgeDisplayData> => ({
        ...data,
        hidden:
          visibleEdgeIds.size > 0 &&
          !((data.connections as GraphEdge[] | undefined) ?? []).some((connection) =>
            visibleEdgeIds.has(connection.id),
          ),
      }),

      labelColor: {
        color: colors.foreground,
      },

      edgeLabelColor: {
        color: colors.foreground,
      },
    }),
    [colors, visibleEdgeIds, visibleNodeIds],
  );
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const renderer = rendererRef.current;

    syncSigmaGraph(graphRef.current, nodes, edges);

    if (renderer) {
      renderer.refresh();
    }
  }, [edges, nodes]);

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
      ...settingsRef.current,
    });
    rendererRef.current = renderer;

    const cleanupLayout = forceSupervisorLayout(renderer, graph);

    return () => {
      cleanupLayout();
      renderer.kill();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;

    if (!renderer) {
      return;
    }

    renderer.setSetting("defaultNodeColor", settings.defaultNodeColor);
    renderer.setSetting("defaultEdgeColor", settings.defaultEdgeColor);
    renderer.setSetting("labelColor", settings.labelColor);
    renderer.setSetting("edgeLabelColor", settings.edgeLabelColor);
    renderer.setSetting("nodeReducer", settings.nodeReducer);
    renderer.setSetting("edgeReducer", settings.edgeReducer);
    renderer.refresh();
  }, [settings]);

  return <div ref={containerRef} className="h-full w-full" />;
}

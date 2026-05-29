// src/components/GraphView.tsx

import "@react-sigma/core/lib/style.css";

import { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import { EdgeArrowProgram } from "sigma/rendering";
import type { NodeHoverDrawingFunction } from "sigma/rendering";
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
  hoveredNodeId?: string | null;
  hoveredEdgeIds?: Set<string>;
  onEdgeHoverChange?: (edgeIds: string[]) => void;
  onNodeHoverChange?: (fqdn: string | null) => void;
  onNodeHoverPositionChange?: (position: { x: number; y: number } | null) => void;
  onNodeSelect?: (fqdn: string) => void;
};

function useSigmaColors() {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState({
    foreground: "",
    primary: "",
    highlight: "",
    mutedForeground: "",
    border: "",
  });

  useEffect(() => {
    // wait until next-themes has applied .dark/.light to <html>
    requestAnimationFrame(() => {
      setColors({
        foreground: cssVarColor("--foreground"),
        primary: cssVarColor("--primary"),
        highlight: cssVarColor("--chart-4"),
        mutedForeground: cssVarColor("--muted-foreground"),
        border: cssVarColorRgba("--muted-foreground"),
      });
    });
  }, [resolvedTheme]);

  return colors;
}

export default function GraphView({
  nodes,
  edges,
  visibleEdgeIds,
  visibleNodeIds,
  hoveredNodeId,
  hoveredEdgeIds,
  onEdgeHoverChange,
  onNodeHoverChange,
  onNodeHoverPositionChange,
  onNodeSelect,
}: GraphViewProps) {
  const graphRef = useRef(buildSigmaGraph(nodes, edges));
  const rendererRef = useRef<Sigma<Attributes, Attributes, Attributes> | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const colors = useSigmaColors();

  const settings = useMemo(
    () => ({
      defaultNodeColor: colors.primary,
      defaultEdgeColor: colors.border,
      defaultDrawNodeHover: drawPlainNodeHover,
      nodeReducer: (node: string, data: Attributes): Partial<NodeDisplayData> => ({
        ...data,
        hidden: visibleNodeIds.size > 0 && !visibleNodeIds.has(node),
        forceLabel: node === hoveredNodeId,
        color: node === hoveredNodeId ? colors.primary : data.color,
        size: node === hoveredNodeId ? Number(data.size ?? 10) * 1.5 : data.size,
        highlighted: node === hoveredNodeId,
      }),
      edgeReducer: (_edge: string, data: Attributes): Partial<EdgeDisplayData> => ({
        ...data,
        ...getEdgeHoverDisplayData(data, hoveredEdgeIds, colors.foreground),
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
    [colors, hoveredEdgeIds, hoveredNodeId, visibleEdgeIds, visibleNodeIds],
  );
  const settingsRef = useRef(settings);
  const onEdgeHoverChangeRef = useRef(onEdgeHoverChange);
  const onNodeHoverChangeRef = useRef(onNodeHoverChange);
  const onNodeHoverPositionChangeRef = useRef(onNodeHoverPositionChange);
  const onNodeSelectRef = useRef(onNodeSelect);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    onEdgeHoverChangeRef.current = onEdgeHoverChange;
  }, [onEdgeHoverChange]);

  useEffect(() => {
    onNodeHoverChangeRef.current = onNodeHoverChange;
  }, [onNodeHoverChange]);
  useEffect(() => {
    onNodeHoverPositionChangeRef.current = onNodeHoverPositionChange;
  }, [onNodeHoverPositionChange]);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

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
    const handleClickNode = ({ node }: { node: string }) => {
      onNodeSelectRef.current?.(node);
    };
    const handleEnterNode = ({ node, event }: { node: string; event?: { x?: number; y?: number } }) => {
      onNodeHoverChangeRef.current?.(node);
      if (typeof event?.x === "number" && typeof event?.y === "number") {
        onNodeHoverPositionChangeRef.current?.({ x: event.x, y: event.y });
      }
    };
    const handleLeaveNode = () => {
      onNodeHoverChangeRef.current?.(null);
      onNodeHoverPositionChangeRef.current?.(null);
    };
    const handleEnterEdge = ({ edge }: { edge: string }) => {
      const connections =
        (graph.getEdgeAttribute(edge, "connections") as GraphEdge[] | undefined) ?? [];

      onEdgeHoverChangeRef.current?.(connections.map((connection) => connection.id));
    };
    const handleLeaveEdge = () => {
      onEdgeHoverChangeRef.current?.([]);
    };

    renderer.on("clickNode", handleClickNode);
    renderer.on("enterEdge", handleEnterEdge);
    renderer.on("enterNode", handleEnterNode);
    renderer.on("leaveEdge", handleLeaveEdge);
    renderer.on("leaveNode", handleLeaveNode);

    return () => {
      renderer.removeListener("clickNode", handleClickNode);
      renderer.removeListener("enterEdge", handleEnterEdge);
      renderer.removeListener("enterNode", handleEnterNode);
      renderer.removeListener("leaveEdge", handleLeaveEdge);
      renderer.removeListener("leaveNode", handleLeaveNode);
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

const drawPlainNodeHover: NodeHoverDrawingFunction = (context, data, settings) => {
  if (!data.label) {
    return;
  }

  const labelColor =
    "color" in settings.labelColor
      ? settings.labelColor.color
      : String(data[settings.labelColor.attribute] ?? data.color);

  context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  context.fillStyle = labelColor ?? data.color;
  context.fillText(data.label, data.x + data.size + 4, data.y + settings.labelSize / 3);
};

function getEdgeHoverDisplayData(
  data: Attributes,
  hoveredEdgeIds: Set<string> | undefined,
  hoverColor: string,
) {
  const isHovered =
    hoveredEdgeIds &&
    hoveredEdgeIds.size > 0 &&
    ((data.connections as GraphEdge[] | undefined) ?? []).some((connection) =>
      hoveredEdgeIds.has(connection.id),
    );

  if (!isHovered) {
    return {};
  }

  return {
    color: hoverColor,
    highlighted: true,
    size: Number(data.size ?? 1) * 1.8,
  };
}

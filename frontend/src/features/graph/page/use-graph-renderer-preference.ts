import type { GraphRenderer } from "@/features/graph/graph-view-types";
import { useEffect, useState } from "react";

const GRAPH_RENDERER_STORAGE_KEY = "graph.renderer";

export function useGraphRendererPreference() {
  const [renderer, setRenderer] = useState<GraphRenderer>(() => {
    const stored = window.localStorage.getItem(GRAPH_RENDERER_STORAGE_KEY);
    return stored === "sigma" ? "sigma" : "d3";
  });

  useEffect(() => {
    window.localStorage.setItem(GRAPH_RENDERER_STORAGE_KEY, renderer);
  }, [renderer]);

  return { renderer, setRenderer };
}

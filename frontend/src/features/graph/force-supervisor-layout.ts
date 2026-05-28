// src/features/graph/force-supervisor-layout.ts

import Graph from "graphology";
import Sigma from "sigma";
import ForceSupervisor from "graphology-layout-force/worker";

import type { MouseCoords, SigmaNodeEventPayload } from "sigma/types";

export function forceSupervisorLayout(renderer: Sigma, graph: Graph) {
  const layout = new ForceSupervisor(graph, {
    isNodeFixed: (_node, attr) => attr.fixed,
    settings: {
      attraction: 0.0005,
      repulsion: 1,
    },
  });

  const cleanupDrag = enableNodeDragging(renderer, graph, layout);

  layout.start();

  return () => {
    cleanupDrag();
    layout.stop();
    layout.kill();
  };
}

function enableNodeDragging(renderer: Sigma, graph: Graph, supervisor?: ForceSupervisor) {
  let draggedNode: string | null = null;
  let isDragging = false;

  const onDownNode = (e: SigmaNodeEventPayload) => {
    isDragging = true;
    draggedNode = e.node;

    graph.setNodeAttribute(draggedNode, "fixed", true);
    renderer.getCamera().disable();

    // supervisor?.stop(); // optional
  };

  const onMouseMove = (e: MouseCoords) => {
    if (!isDragging || !draggedNode) return;

    const pos = renderer.viewportToGraph(e);

    graph.setNodeAttribute(draggedNode, "x", pos.x);
    graph.setNodeAttribute(draggedNode, "y", pos.y);

    e.preventSigmaDefault();
    e.original.preventDefault();
    e.original.stopPropagation();
  };

  const onMouseUp = () => {
    if (draggedNode) {
      graph.removeNodeAttribute(draggedNode, "fixed");
    }

    isDragging = false;
    draggedNode = null;

    renderer.getCamera().enable();
    supervisor?.start(); // optional
  };

  renderer.on("downNode", onDownNode);
  renderer.getMouseCaptor().on("mousemovebody", onMouseMove);
  renderer.getMouseCaptor().on("mouseup", onMouseUp);

  // cleanup function
  return () => {
    renderer.removeListener("downNode", onDownNode);
    renderer.getMouseCaptor().removeListener("mousemovebody", onMouseMove);
    renderer.getMouseCaptor().removeListener("mouseup", onMouseUp);
  };
}

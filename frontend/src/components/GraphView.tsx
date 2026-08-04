import GraphViewD3 from "./GraphViewD3"
import GraphViewSigma from "./GraphViewSigma"
import type { GraphRenderer, GraphViewProps } from "@/features/graph/graph-view-types"

export default function GraphView({
  renderer,
  ...props
}: GraphViewProps & { renderer: GraphRenderer }) {
  if (renderer === "sigma") {
    return <GraphViewSigma {...props} />
  }

  return <GraphViewD3 {...props} />
}

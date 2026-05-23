import "./NodeDetailsPane.css";
import { useMemo, useState } from "react";
import { buildEffectiveFilters, matchesEdgeFilters, matchesNodeConnectionFilters } from "../filters/matchesFilter";
import type { filter } from "../types/filter";
import type { EdgeDetails, NodeDetails } from "../types/graph";
import EdgeConnectionDetails, { type AggregatedEdgeConnection } from "./EdgeConnectionDetails";
import NodeConnectionDetails from "./NodeConnectionDetails";

type Props = {
  node: NodeDetails | null;
  edge: EdgeDetails | null;
  filters: filter[];
  searchQuery: string;
};

type PaneMode = "auto" | "minimized";

export default function NodeDetailsPanel({ node, edge, filters, searchQuery }: Props) {
  const [paneMode, setPaneMode] = useState<PaneMode>("auto");
  const effectiveFilters = useMemo(() => buildEffectiveFilters(filters, searchQuery), [filters, searchQuery]);
  const visibleTargets = useMemo(() => {
    if (!node) return [];
    return node.portTargets.filter((target) => matchesNodeConnectionFilters(node, target, effectiveFilters));
  }, [node, effectiveFilters]);
  const visibleEdgeConnections = useMemo(() => {
    if (!edge) return [];
    const sourceNode: NodeDetails = {
      label: edge.source_fqdn,
      ip: edge.source_ip,
      fqdn: edge.source_fqdn,
      color: "",
      subnet: "",
      portTargets: [],
      size: 0,
      x: 0,
      y: 0,
    };
    const targetNode: NodeDetails = {
      label: edge.target_fqdn,
      ip: edge.target_ip,
      fqdn: edge.target_fqdn,
      color: "",
      subnet: "",
      portTargets: [],
      size: 0,
      x: 0,
      y: 0,
    };

    return edge.connections.filter((connection) =>
      matchesEdgeFilters({ sourceNode, targetNode, connections: [connection] }, effectiveFilters),
    );
  }, [edge, effectiveFilters]);
  const visibleNodeConnectionCount = useMemo(
    () => visibleTargets.reduce((sum, target) => sum + target.seenCount, 0),
    [visibleTargets],
  );
  const aggregatedVisibleEdgeConnections = useMemo<AggregatedEdgeConnection[]>(() => {
    const groups = new Map<string, AggregatedEdgeConnection>();

    for (const connection of visibleEdgeConnections) {
      const key = `${connection.source_port}-${connection.target_port}-${connection.source_pid ?? connection.pid ?? -1}-${connection.source_process_name ?? connection.process_name ?? ""}-${connection.target_pid ?? connection.pid ?? -1}-${connection.target_process_name ?? connection.process_name ?? ""}`;
      const seenCount = Math.max(connection.seen_count ?? 1, 1);
      const existing = groups.get(key);
      if (existing) {
        existing.seenCount += seenCount;
        continue;
      }
      groups.set(key, { connection, seenCount });
    }

    return Array.from(groups.values()).sort((a, b) =>
      b.seenCount - a.seenCount
      || a.connection.source_port - b.connection.source_port
      || a.connection.target_port - b.connection.target_port,
    );
  }, [visibleEdgeConnections]);
  const visibleEdgeConnectionCount = useMemo(
    () => aggregatedVisibleEdgeConnections.reduce((sum, entry) => sum + entry.seenCount, 0),
    [aggregatedVisibleEdgeConnections],
  );

  return (
    <aside className={`details-panel ${paneMode}`}>
      {paneMode === "minimized" ? (
        <button
          type="button"
          className="details-minimized-strip"
          onClick={() => setPaneMode("auto")}
          title="Restore auto size"
          aria-label="Restore details pane auto size"
        >
          <span aria-hidden="true">▲</span>
        </button>
      ) : (
        <div className="details-content">
          {node ? (
            <NodeConnectionDetails
              node={node}
              visibleTargets={visibleTargets}
              visibleNodeConnectionCount={visibleNodeConnectionCount}
              onMinimize={() => setPaneMode("minimized")}
            />
          ) : edge ? (
            <EdgeConnectionDetails
              edge={edge}
              aggregatedVisibleEdgeConnections={aggregatedVisibleEdgeConnections}
              visibleEdgeConnectionCount={visibleEdgeConnectionCount}
              onMinimize={() => setPaneMode("minimized")}
            />
          ) : (
            <p id="no-node-selected">Select a node or edge to see details.</p>
          )}
        </div>
      )}
    </aside>
  );
}

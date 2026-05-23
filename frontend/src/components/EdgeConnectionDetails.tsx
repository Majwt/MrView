import type { EdgeDetails, GraphEdge } from "../types/graph";
import DetailsNote from "./details-note";
import { renderLastSeen, renderPortService, renderProcessName } from "./utils";

export type AggregatedEdgeConnection = {
  connection: GraphEdge;
  seenCount: number;
};

type Props = {
  edge: EdgeDetails;
  aggregatedVisibleEdgeConnections: AggregatedEdgeConnection[];
  visibleEdgeConnectionCount: number;
  onMinimize: () => void;
};



export default function EdgeConnectionDetails({ edge, aggregatedVisibleEdgeConnections, visibleEdgeConnectionCount, onMinimize }: Props) {
  return (
    <div className="details-node-info">
      <header className="details-header">
        <span className="details-header-fqdn">{edge.source_fqdn} → {edge.target_fqdn}</span>
        <div className="details-header-subtitle">
          <span className="details-header-ip">{edge.source_ip} → {edge.target_ip}</span>
        </div>
        <div className="details-header-metrics">
          <span className="details-count-pill">{aggregatedVisibleEdgeConnections.length} aggregated rows</span>
          <span className="details-count-pill emphasis">{visibleEdgeConnectionCount} connections</span>
        </div>
        <button
          type="button"
          className="details-minimize-button"
          onClick={onMinimize}
          title="Minimize details pane"
          aria-label="Minimize details pane"
        >
          <span aria-hidden="true">▾</span>
        </button>
      </header>
      <DetailsNote/>
      {aggregatedVisibleEdgeConnections.length > 0 ? (
        <table className="details-table">
          <thead>
            <tr>
              <th>From Service</th>
              <th>From Port</th>
              <th>From Process</th>
              <th>To Service</th>
              <th>To Port</th>
              <th>To Process</th>
              <th>Connections</th>
            </tr>
          </thead>
          <tbody>
            {aggregatedVisibleEdgeConnections.map(({ connection, seenCount }, index) => (
              <tr key={`${edge.id}-${connection.source_port}-${connection.target_port}-${connection.source_pid ?? connection.pid ?? 0}-${connection.source_process_name ?? connection.process_name ?? ""}-${connection.target_pid ?? connection.pid ?? 0}-${connection.target_process_name ?? connection.process_name ?? ""}-${index}`}>
                <td>{renderPortService(connection.source_port)}</td>
                <td>{connection.source_port}</td>
                <td>{renderProcessName(connection.source_process_name ?? connection.process_name ?? null, connection.source_pid ?? connection.pid ?? 0)}</td>
                <td>{renderPortService(connection.target_port)}</td>
                <td>{connection.target_port}</td>
                <td>{renderProcessName(connection.target_process_name ?? connection.process_name ?? null, connection.target_pid ?? connection.pid ?? 0)}</td>
                <td>{seenCount}</td>
                <td className="last-seen-cell">{renderLastSeen(connection.last_seen ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No connections match current filters.</p>
      )}
    </div>
  );
}

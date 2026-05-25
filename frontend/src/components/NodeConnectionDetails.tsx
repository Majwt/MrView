import type { NodeDetails, NodePortTarget } from "../types/graph";
import DetailsNote from "./details-note";
import { getDirectionMeta, renderLastSeen, renderPortService, renderProcessName } from "./utils";

type Props = {
  node: NodeDetails;
  visibleTargets: NodePortTarget[];
  visibleNodeConnectionCount: number;
};


export default function NodeConnectionDetails({ node, visibleTargets, visibleNodeConnectionCount }: Props) {
  const customerSummaryParts: string[] = [];
  if (node.customer?.name) customerSummaryParts.push(node.customer.name);
  if (node.customer?.id !== undefined && node.customer?.id !== null && node.customer?.id !== "" && node.customer?.id !== -1) {
    customerSummaryParts.push(`ID ${node.customer.id}`);
  }
  if (node.customer?.cmdb_ci_id) customerSummaryParts.push(`CMDB ${node.customer.cmdb_ci_id}`);
  const customerSummary = customerSummaryParts.join(" • ");
  const hasCustomerInfo = customerSummaryParts.length > 0;

  return (
    <div className="details-node-info">
      <header className="details-header">
        <div className="details-header-top">
          <span className="details-header-fqdn">{node.fqdn}</span>
          <div className="details-header-metrics">
            <span className="details-count-pill">{visibleTargets.length} aggregated rows</span>
            <span className="details-count-pill emphasis">{visibleNodeConnectionCount} connections</span>
          </div>
        </div>
        <div className="details-header-bottom">
          <span className="details-header-ip">{node.ip}</span>
          {node.subnet ? (
            <span className="details-header-subnet">({node.subnet})</span>
          ) : (
            <span className="details-header-subnet">(no subnet info)</span>
          )}
          {hasCustomerInfo && (
            <>
              <span className="details-header-divider" aria-hidden="true">•</span>
              <span className="details-header-customer-inline">
                <span className="details-header-customer-label">Customer</span>
                <span className="details-header-customer-value">{customerSummary}</span>
              </span>
            </>
          )}
        </div>
      </header>
      <DetailsNote />
      {visibleTargets.length > 0 ? (
        <table className="details-table">
          <thead>
            <tr>
              <th>Direction</th>
              <th>Local Service</th>
              <th>Local Port</th>
              <th>Local Process</th>
              <th>Peer Host</th>
              <th>Peer Ip</th>
              <th>Peer Service</th>
              <th>Peer Port</th>
              <th>Connections</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {visibleTargets.map((target) => (
              <tr key={`${target.port}-${target.remote_port}-${target.fqdn}-${target.ip}-${target.direction}-${target.pid}-${target.processName ?? ""}`}>
                <td>
                  <span className={`direction-pill ${target.direction}`} title={getDirectionMeta(target).label}>
                    <span className="direction-glyph" aria-hidden="true">{getDirectionMeta(target).glyph}</span>
                    {getDirectionMeta(target).label}
                  </span>
                </td>
                <td>{renderPortService(target.port)}</td>
                <td>{target.port}</td>
                <td>{renderProcessName(target.processName, target.pid)}</td>
                <td>{target.fqdn}</td>
                <td>{target.ip}</td>
                <td>{renderPortService(target.remote_port)}</td>
                <td>{target.remote_port}</td>
                <td>{target.seenCount}</td>
                <td className="last-seen-cell">{renderLastSeen(target.lastSeen)}</td>
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

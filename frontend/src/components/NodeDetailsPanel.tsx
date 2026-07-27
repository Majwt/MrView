import type { GraphSnapshot } from "@/features/graph/types";
import { HostCell, MonoIdCell, NumericCell, RichDateCell } from "./table/styled-cells";
import { Button } from "./ui/button";
import type { ReactNode } from "react";

export default function NodeDetailsPanel({
  node,
  onBack,
}: {
  node: NonNullable<GraphSnapshot["nodes"][number]>;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-md border bg-background p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Node Details</h2>
          <p className="font-mono text-xs text-muted-foreground">{node.fqdn}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onBack}>
          Back To Table
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Identity
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="FQDN">
              <HostCell primary={node.fqdn}  />
            </DetailItem>
            <DetailItem label="Customer">
              <div className="space-y-0.5">
                <div className="text-sm">{node.customer.name || "-"}</div>
                <div className="flex flex-row gap-1">
                  <div className="text-[11px] text-muted-foreground">Customer ID</div>
                  <div className="text-[11px] text-muted-foreground font-bold">{node.customer.id}</div>
                </div>
              </div>
            </DetailItem>
            <DetailItem label="CmdbCiId">
              <MonoIdCell value={node.customer.cmdb_ci_id} />
            </DetailItem>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Activity
          </h3>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            <DetailItem label="# Distinct connections">
              <NumericCell value={node.distinct_edge} emphasize />
            </DetailItem>
            <DetailItem label="# Connections">
              <NumericCell value={node.connection_count} emphasize />
            </DetailItem>
            <DetailItem label="Last Seen">
              <RichDateCell value={node.last_seen} />
            </DetailItem>
            <DetailItem label="First Seen">
              <RichDateCell value={node.first_seen} />
            </DetailItem>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Interfaces
        </h3>
        <div className="space-y-2 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {node.interfaces.map((netInterface, index) => (
            <div
              key={`${netInterface.ip}-${index}`}
              className="rounded-md border bg-muted/20 p-3 text-xs"
            >
              <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                {netInterface.adapter}
              </div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-2">
                <DetailItem label="IP">
                  <HostCell primary={netInterface.ip} secondary={netInterface.subnet || undefined} />
                </DetailItem>
                <DetailItem label="MAC">
                  <MonoIdCell value={netInterface.mac} />
                </DetailItem>
                {netInterface.status ? (
                  <DetailItem label="Status">
                    <div className="text-sm">{netInterface.status}</div>
                  </DetailItem>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/15 px-3 py-2">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}


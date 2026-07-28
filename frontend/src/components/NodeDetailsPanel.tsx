import type { GraphSnapshot } from "@/features/graph/types";
import { RichDateCell } from "./table/styled-cells";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export default function NodeDetailsPanel({
  node,
  onBack,
}: {
  node: NonNullable<GraphSnapshot["nodes"][number]>;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 gap-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold">{node.fqdn}</p>
          <p className="text-xs text-muted-foreground">{node.customer.name || "Unknown customer"}</p>
        </div>
        <button
          type="button"
          aria-label="Deselect node"
          className="mt-0.5 shrink-0 rounded-sm p-1 hover:bg-muted"
          onClick={onBack}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* CmdbCiId — highlighted */}
      {node.customer.cmdb_ci_id ? (
        <div className="rounded-md border-2 bg-muted/30 px-3 py-2">
          <div className="mb-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">CMDB CI ID</div>
          <span className="font-mono text-sm font-semibold">{node.customer.cmdb_ci_id}</span>
        </div>
      ) : (
        <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          No CMDB CI ID
        </div>
      )}

      {/* Activity */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Activity
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Distinct Connections" value={node.distinct_edge} />
          <Stat label="Total Connections" value={node.connection_count} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <LabelValue label="Last Seen">
            <RichDateCell value={node.last_seen} />
          </LabelValue>
          <LabelValue label="First Seen">
            <RichDateCell value={node.first_seen} />
          </LabelValue>
        </div>
      </div>

      {/* Interfaces */}
      {node.interfaces.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Interfaces
          </h3>
          <div className="flex flex-col gap-2">
            {node.interfaces.map((intf, index) => (
              <div
                key={`${intf.ip}-${index}`}
                className="rounded-md border bg-muted/20 px-3 py-2 text-xs"
              >
                {intf.adapter && (
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {intf.adapter}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <Row label="IP" value={intf.ip} mono />
                  {intf.subnet && <Row label="Subnet" value={intf.subnet} mono />}
                  {intf.mac && <Row label="MAC" value={intf.mac} mono />}
                  {intf.status && <Row label="Status" value={intf.status} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/15 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

function LabelValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/15 px-3 py-2">
      <div className="mb-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </>
  );
}


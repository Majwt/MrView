import type { GraphSnapshot } from "@/features/graph/types";
import { RichDateCell } from "./table/styled-cells";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/ui/copy-button";

export default function NodeDetailsPanel({
  node,
  isLoadingDetails,
  onBack,
}: {
  node: NonNullable<GraphSnapshot["nodes"][number]>;
  isLoadingDetails?: boolean;
  onBack: () => void;
}) {
  const hasCustomer = node.customer !== undefined;
  const hasDates = !!node.last_seen;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 gap-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="group/item flex min-w-0 items-center gap-1">
            <p className="truncate font-mono text-sm font-semibold">{node.fqdn}</p>
            <CopyButton
              value={node.fqdn}
              label="FQDN"
              className="opacity-0 transition-opacity group-hover/item:opacity-100"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {hasCustomer ? (node.customer!.name || "Unknown customer") : node.hostname}
          </p>
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
      {isLoadingDetails && !hasCustomer ? (
        <div className="h-10 animate-pulse rounded-md bg-muted" />
      ) : hasCustomer ? (
        node.customer!.cmdb_ci_id ? (
          <div className="rounded-md border-2 bg-muted/30 px-3 py-2">
            <div className="mb-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">CIID</div>
            <div className="group/item flex items-center gap-1">
              <span className="font-mono text-sm font-semibold">{node.customer!.cmdb_ci_id}</span>
              <CopyButton
                value={node.customer!.cmdb_ci_id}
                label="CIID"
                className="opacity-0 transition-opacity group-hover/item:opacity-100"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            No CIID
          </div>
        )
      ) : null}

      {/* Activity */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Activity
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Distinct Connections" value={node.distinct_edge} />
          <Stat label="Total Connections" value={node.connection_count} />
        </div>
        {isLoadingDetails && !hasDates ? (
          <div className="mt-2 h-10 animate-pulse rounded-md bg-muted" />
        ) : hasDates ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <LabelValue label="Last Seen">
              <RichDateCell value={node.last_seen!} />
            </LabelValue>
            <LabelValue label="First Seen">
              <RichDateCell value={node.first_seen!} />
            </LabelValue>
          </div>
        ) : null}
      </div>

      {/* Client */}
      {(node.client && node.client !== "Unknown") || (node.client_version && node.client_version !== "Unknown") ? (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Agent
          </h3>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
            <div className="grid items-center gap-x-4 gap-y-1" style={{ gridTemplateColumns: "auto 1fr" }}>
              {node.client && node.client !== "Unknown" && <Row label="Client" value={node.client} />}
              {node.client_version && node.client_version !== "Unknown" && <Row label="Version" value={node.client_version} mono />}
            </div>
          </div>
        </div>
      ) : null}

      {/* Interfaces */}
      {isLoadingDetails && !hasCustomer ? (
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-16 animate-pulse rounded-md bg-muted" />
        </div>
      ) : (node.interfaces ?? []).length > 0 ? (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Interfaces
          </h3>
          <div className="flex flex-col gap-2">
            {node.interfaces!.map((intf, index) => (
              <div
                key={`${intf.ipv4 ?? intf.ipv6 ?? intf.mac}-${index}`}
                className="rounded-md border bg-muted/20 px-3 py-2 text-xs"
              >
                {intf.adapter && (
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {intf.adapter}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {intf.ipv4 && <Row label="IPv4" value={intf.ipv4} mono />}
                  {intf.subnetv4 && <Row label="Subnet" value={intf.subnetv4} mono />}
                  {intf.ipv6 && <Row label="IPv6" value={intf.ipv6} mono />}
                  {intf.subnetv6 && <Row label="Subnet6" value={intf.subnetv6} mono />}
                  {intf.mac && <Row label="MAC" value={intf.mac} mono />}
                  {intf.status && <Row label="Status" value={intf.status} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
      <span className="text-muted-foreground [text-box-trim:trim-both] [text-box-edge:cap_alphabetic]">{label}</span>
      <div className="group/item flex min-w-0 items-center gap-1">
        <span className={mono ? "truncate font-mono" : "truncate"}>{value}</span>
        <CopyButton
          value={value}
          label={label}
          className="opacity-0 transition-opacity group-hover/item:opacity-100"
        />
      </div>
    </>
  );
}


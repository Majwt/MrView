import { CopyButton } from "@/components/ui/copy-button";
import type { GraphSnapshot, OpenPort } from "@/features/graph/types";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { RichDateCell } from "@/features/graph/ui/table/styled-cells";

export default function NodeDetailsPanel({
  node,
  isLoadingDetails,
  ports,
  onBack,
}: {
  node: NonNullable<GraphSnapshot["nodes"][number]>;
  isLoadingDetails?: boolean;
  ports?: OpenPort[] | null;
  onBack: () => void;
}) {
  const hasCustomer = node.customer !== undefined;
  const hasDates = !!node.last_seen;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden p-4">

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

      {/* CmdbCiId - highlighted */}
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

      {/* Operating System */}
      {node.os && node.os !== "Unknown" ? (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            OS
          </h3>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
            <div className="grid items-center gap-x-4 gap-y-1" style={{ gridTemplateColumns: "auto 1fr" }}>
              <Row label="Version" value={node.os} />
            </div>
          </div>
        </div>
      ) : null}

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

      {/* Open Ports */}
      {ports && ports.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            TCP Listen & UDP
          </h3>
          <div className="rounded-md border bg-muted/20 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Proto</th>
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Local</th>
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Port</th>
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Foreign</th>
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">F.Port</th>
                </tr>
              </thead>
              <tbody>
                {compactPorts(ports).map((p, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-2 py-0.5 text-muted-foreground">{p.proto ?? ""}</td>
                    <td className="px-2 py-0.5 font-mono text-[11px]">{p.local_ip ?? ""}</td>
                    {p.range_end != null ? (
                      <>
                        <td className="px-2 py-0.5 font-mono">{p.local_port}–{p.range_end} <span className="text-muted-foreground">({p.range_count}{p.pid != null ? `, pid ${p.pid}` : ""})</span></td>
                        <td className="px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{p.foreign_ip ?? ""}</td>
                        <td className="px-2 py-0.5 font-mono text-muted-foreground">{p.foreign_port ?? ""}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-0.5 font-mono">{p.local_port ?? ""}</td>
                        <td className="px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{p.foreign_ip ?? ""}</td>
                        <td className="px-2 py-0.5 font-mono text-muted-foreground">{p.foreign_port ?? ""}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

    </div>
  );
}

type CompactedPort = OpenPort & { range_end?: string; range_count?: number };

function compactPorts(ports: OpenPort[]): CompactedPort[] {
  const sorted = [...ports].sort((a, b) => {
    const ip = (a.local_ip ?? "").localeCompare(b.local_ip ?? "");
    if (ip !== 0) return ip;
    return (parseInt(a.local_port ?? "0") || 0) - (parseInt(b.local_port ?? "0") || 0);
  });
  const result: CompactedPort[] = [];
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i];
    let j = i + 1;
    while (
      j < sorted.length &&
      sorted[j].proto === start.proto &&
      sorted[j].local_ip === start.local_ip &&
      sorted[j].pid != null && sorted[j].pid === start.pid &&
      (parseInt(sorted[j].local_port ?? "0") || 0) === (parseInt(sorted[j - 1].local_port ?? "0") || 0) + 1
    ) j++;
    const count = j - i;
    if (count > 5) {
      result.push({ ...start, range_end: sorted[j - 1].local_port ?? undefined, range_count: count });
      i = j;
    } else {
      result.push(start);
      i++;
    }
  }
  return result;
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
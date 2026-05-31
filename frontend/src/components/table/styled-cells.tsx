import { cn } from "@/lib/utils";
import { Activity, Plug, Terminal } from "lucide-react";
import { formatTableDate } from "./format-date";

export function HostCell({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{primary}</div>
      {secondary ? <div className="truncate text-xs text-muted-foreground">{secondary}</div> : null}
    </div>
  );
}

export function MonoIdCell({ value }: { value: string }) {
  return (
    <span className="inline-block rounded-sm bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] tabular-nums">
      {value}
    </span>
  );
}

export function NumericCell({ value, emphasize = false }: { value: number; emphasize?: boolean }) {
  return (
    <span
      className={cn(
        "block text-right font-mono tabular-nums",
        emphasize ? "font-semibold text-foreground" : "text-muted-foreground",
      )}
    >
      {value.toLocaleString()}
    </span>
  );
}


export function ProcessCell({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="inline-flex max-w-full items-center gap-1.5">
      <Terminal className="size-3.5 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </div>
  );
}

export function ServiceCell({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="inline-flex max-w-full items-center gap-1.5">
      <Plug className="size-3.5 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </div>
  );
}

export function SeenCountCell({ value }: { value: number }) {
  const emphasize = value >= 5000;

  return (
    <div className="inline-flex w-full items-center justify-end gap-1.5">
      {emphasize ? <Activity className="size-3.5 text-primary" /> : null}
      <NumericCell value={value} emphasize={emphasize} />
    </div>
  );
}

export function RichDateCell({ value }: { value: unknown }) {
  const absolute = formatTableDate(value);
  const relative = formatRelativeTime(value);

  return (
    <div className="min-w-0">
      <div className="font-medium tabular-nums">{relative || "-"}</div>
      <div className="truncate text-[11px] text-muted-foreground tabular-nums" title={absolute}>
        {absolute}
      </div>
    </div>
  );
}

function formatRelativeTime(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    return "";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diffMs = timestamp - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (absMs < minute) {
    return "Just now"
  }

  if (absMs < hour) {
    return rtf.format(Math.round(diffMs / minute), "minute");
  }

  if (absMs < day) {
    return rtf.format(Math.round(diffMs / hour), "hour");
  }

  return rtf.format(Math.round(diffMs / day), "day");
}

import type { NodePortTarget } from "../types/graph";
import { getServiceName, isDynamicPort } from "../utils/portServices";



export function getDirectionMeta(target: NodePortTarget) {
  return target.direction === "outgoing"
    ? { glyph: "↗", label: "Outgoing" }
    : { glyph: "↘", label: "Incoming" };
}


export function renderPortService(port: number) {
  const label = getServiceName(port);
  return (
    <span className={`port-service ${isDynamicPort(port) ? "dynamic" : ""}`} title={`Port ${port}`}>
      {label}
    </span>
  );
}

export function renderProcessName(processName: string | null, pid: number) {
  const label = processName ?? "Unknown Process";
  return (
    <span className="port-service" title={`PiD ${pid}`}>
      {label}
    </span>
  );
}

export function renderLastSeen(value: string) {
  const parsed = Date.parse(value);
  const isValid = Number.isFinite(parsed);
  const display = isValid
    ? new Date(parsed).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "medium" })
    : value;

  return (
    <time className={`last-seen-chip ${isValid ? "" : "invalid"}`} dateTime={isValid ? new Date(parsed).toISOString() : undefined} title={value}>
      {display}
    </time>
  );
}

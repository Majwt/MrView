import type { filter } from "../types/filter";

export const FILTERS_QUERY_KEY = "filters";
export const SEARCH_QUERY_KEY = "q";
export const SELECTED_NODE_QUERY_KEY = "node";
export const SELECTED_EDGE_QUERY_KEY = "edge";
export const FILTERS_QUERY_COMPACT_PREFIX = "c:";
export const FILTER_ENTRY_SEPARATOR = ",";

const FILTER_TYPE_TO_CODE: Record<filter["type"], string> = {
  ip: "i",
  fqdn: "f",
  port: "p",
  process: "r",
  subnet: "s",
  service: "v",
};

const FILTER_OPERATION_TO_CODE: Record<filter["operation"], string> = {
  include: "i",
  exclude: "e",
};

const FILTER_CODE_TO_TYPE: Record<string, filter["type"] | undefined> = {
  i: "ip",
  f: "fqdn",
  p: "port",
  r: "process",
  s: "subnet",
  v: "service",
};

const FILTER_CODE_TO_OPERATION: Record<string, filter["operation"] | undefined> = {
  i: "include",
  e: "exclude",
};

export const refreshIntervalMinutes: number = import.meta.env.VITE_REFRESH_INTERVAL_MINUTES || 1;

export function readInitialSearchQuery(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(SEARCH_QUERY_KEY) ?? "";
}

export function readInitialSelectedNodeId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(SELECTED_NODE_QUERY_KEY) ?? "";
}

export function readInitialSelectedEdgeId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(SELECTED_EDGE_QUERY_KEY) ?? "";
}

export function readInitialFilters(): filter[] {
  const params = new URLSearchParams(window.location.search);
  const rawFilters = params.get(FILTERS_QUERY_KEY);
  if (!rawFilters) return [];

  if (!rawFilters.startsWith(FILTERS_QUERY_COMPACT_PREFIX)) return [];
  return parseCompactFilters(rawFilters.slice(FILTERS_QUERY_COMPACT_PREFIX.length));
}

function parseCompactFilters(rawFilters: string): filter[] {
  if (!rawFilters) return [];

  return rawFilters.split(FILTER_ENTRY_SEPARATOR).flatMap((entry) => {
    if (entry.length < 3 || entry[2] !== ":") return [];

    const type = FILTER_CODE_TO_TYPE[entry[0]];
    const operation = FILTER_CODE_TO_OPERATION[entry[1]];
    if (!type || !operation) return [];

    try {
      const value = decodeURIComponent(entry.slice(3));
      return [{ id: crypto.randomUUID(), type, operation, value }];
    } catch {
      return [];
    }
  });
}

export function serializeFiltersForUrl(filters: filter[]): string {
  const encodedEntries = filters.map(({ type, operation, value }) => {
    const encodedValue = encodeURIComponent(value);
    return `${FILTER_TYPE_TO_CODE[type]}${FILTER_OPERATION_TO_CODE[operation]}:${encodedValue}`;
  });

  return `${FILTERS_QUERY_COMPACT_PREFIX}${encodedEntries.join(FILTER_ENTRY_SEPARATOR)}`;
}

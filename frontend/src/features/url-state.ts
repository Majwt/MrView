import { filterFields, filterOperators } from "./filters/filter-definitions";
import type { FilterRule, FiltersState } from "./filters/types";

export type TableView = "nodes" | "connections";

export type GraphQuickFiltersState = {
  hideIsolatedNodes: boolean;
  staleThresholdHours: number | null;
  managedOnly: boolean;
};

export type UrlState = {
  filters: FiltersState;
  globalSearch: string;
  selectedNodeFqdn: string | null;
  tableView: TableView;
  quickFilters: GraphQuickFiltersState;
};

const validFields = new Set(filterFields.map((field) => field.value));
const validOperators = new Set(filterOperators.map((operator) => operator.value));

export function readUrlState(): UrlState {
  if (typeof window === "undefined") {
    return getDefaultUrlState();
  }

  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const node = params.get("node");
  const search = params.get("q") ?? "";
  const hideIsolatedParam = params.get("qi");
  const managedOnlyParam = params.get("qm");
  const staleThresholdParam = params.get("qs");

  const staleThresholdHours =
    staleThresholdParam === null
      ? 30 * 24
      : staleThresholdParam === "none"
        ? null
        : Number.isFinite(Number(staleThresholdParam))
          ? Number(staleThresholdParam)
          : 30 * 24;

  return {
    filters: { rules: decodeFilterRules(params.get("filters")) },
    globalSearch: search,
    selectedNodeFqdn: node || null,
    tableView: view === "connections" ? "connections" : "nodes",
    quickFilters: {
      hideIsolatedNodes: hideIsolatedParam === null ? true : hideIsolatedParam === "1",
      managedOnly: managedOnlyParam === "1",
      staleThresholdHours,
    },
  };
}

export function writeUrlState(state: UrlState) {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams();

  if (state.tableView !== "nodes") {
    params.set("view", state.tableView);
  }

  if (state.selectedNodeFqdn) {
    params.set("node", state.selectedNodeFqdn);
  }

  if (state.globalSearch.trim() !== "") {
    params.set("q", state.globalSearch);
  }

  if (state.filters.rules.length > 0) {
    params.set("filters", encodeFilterRules(state.filters.rules));
  }

  if (!state.quickFilters.hideIsolatedNodes) {
    params.set("qi", "0");
  }

  if (state.quickFilters.managedOnly) {
    params.set("qm", "1");
  }

  if (state.quickFilters.staleThresholdHours === null) {
    params.set("qs", "none");
  } else if (state.quickFilters.staleThresholdHours !== 30 * 24) {
    params.set("qs", String(state.quickFilters.staleThresholdHours));
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;

  if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(null, "", nextUrl);
  }
}

function getDefaultUrlState(): UrlState {
  return {
    filters: { rules: [] },
    globalSearch: "",
    selectedNodeFqdn: null,
    tableView: "nodes",
    quickFilters: {
      hideIsolatedNodes: true,
      managedOnly: false,
      staleThresholdHours: 30 * 24,
    },
  };
}

function encodeFilterRules(rules: FilterRule[]) {
  const json = JSON.stringify(rules);
  const bytes = new TextEncoder().encode(json);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeFilterRules(value: string | null): FilterRule[] {
  if (!value) {
    return [];
  }

  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = window.atob(paddedBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isFilterRule);
  } catch {
    return [];
  }
}

function isFilterRule(value: unknown): value is FilterRule {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rule = value as Partial<FilterRule>;

  return (
    typeof rule.id === "string" &&
    typeof rule.field === "string" &&
    typeof rule.operator === "string" &&
    validFields.has(rule.field) &&
    validOperators.has(rule.operator)
  );
}

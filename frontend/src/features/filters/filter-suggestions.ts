import type { GraphSnapshot } from "../graph/types";
import type { FilterField } from "./types";

export type FilterSuggestions = Partial<Record<FilterField, string[]>>;

const MAX_SUGGESTIONS_PER_FIELD = 50;

export function buildFilterSuggestions(snapshot: GraphSnapshot | null): FilterSuggestions {
  if (!snapshot) {
    return {};
  }

  const buckets = new Map<FilterField, Map<string, number>>();

  function add(field: FilterField, value: unknown) {
    if (value === null || value === undefined) {
      return;
    }

    const normalized = String(value).trim();

    if (!normalized) {
      return;
    }

    const bucket = buckets.get(field) ?? new Map<string, number>();
    bucket.set(normalized, (bucket.get(normalized) ?? 0) + 1);
    buckets.set(field, bucket);
  }

  for (const node of snapshot.nodes) {
    add("fqdn", node.fqdn);
    add("hostname", node.hostname);

    if (!node.is_placeholder && node.customer && node.customer.name !== "Unknown") {
      add("customer", node.customer.name);
    }

    for (const netInterface of node.interfaces ?? []) {
      add("ip", netInterface.ip);
      add("mac", netInterface.mac);
    }
  }

  for (const edge of snapshot.edges) {
    add("fqdn", edge.source_fqdn);
    add("fqdn", edge.target_fqdn);
    add("ip", edge.source_ip);
    add("ip", edge.target_ip);
    add("process_name", edge.source_process_name);
    add("process_name", edge.target_process_name);
    add("service_name", edge.service_name);
    add("service_port", edge.source_port);
    add("service_port", edge.target_port);
    add("seen_count", edge.seen_count);
  }

  return Object.fromEntries(
    [...buckets.entries()].map(([field, values]) => [
      field,
      [...values.entries()]
        .sort((left, right) => {
          const countDiff = right[1] - left[1];

          if (countDiff !== 0) {
            return countDiff;
          }

          return left[0].localeCompare(right[0]);
        })
        .slice(0, MAX_SUGGESTIONS_PER_FIELD)
        .map(([value]) => value),
    ]),
  ) as FilterSuggestions;
}

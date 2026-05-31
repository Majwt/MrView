import type { GraphEdge, GraphNode, GraphSnapshot } from "../graph/types";
import { getFilterFieldDefinition, getFilterTarget } from "./filter-definitions";
import type { FilterRule, FiltersState } from "./types";

export function applyGraphFilters(graph: GraphSnapshot, filters: FiltersState): GraphSnapshot {
  const activeRules = filters.rules.filter(isUsableRule);

  if (activeRules.length === 0) {
    return graph;
  }

  const nodeRules = activeRules.filter((rule) => isNodeRule(rule));
  const edgeRules = activeRules.filter((rule) => isEdgeRule(rule));
  const matchingNodeIds =
    nodeRules.length === 0
      ? null
      : new Set(
          graph.nodes.filter((node) => nodeMatchesAllRules(node, nodeRules)).map((node) => node.fqdn),
        );

  const edges = graph.edges.filter((edge) => {
    if (!edgeRules.every((rule) => edgeMatchesRule(edge, rule))) {
      return false;
    }

    if (!matchingNodeIds) {
      return true;
    }

    return matchingNodeIds.has(edge.source_fqdn) || matchingNodeIds.has(edge.target_fqdn);
  });

  const connectedNodeIds = new Set<string>();
  for (const edge of edges) {
    connectedNodeIds.add(edge.source_fqdn);
    connectedNodeIds.add(edge.target_fqdn);
  }
  const nodes = graph.nodes.filter((node) => connectedNodeIds.has(node.fqdn));

  return {
    nodes,
    edges,
    cursor: graph.cursor,
  };
}

function isNodeRule(rule: FilterRule): boolean {
  const target = getFilterTarget(rule.field);

  return target === "node" || target === "both";
}

function isEdgeRule(rule: FilterRule): boolean {
  const target = getFilterTarget(rule.field);

  return target === "connection" || target === "both";
}

function nodeMatchesAllRules(node: GraphNode, rules: FilterRule[]) {
  return rules.every((rule) => nodeMatchesRule(node, rule));
}

function nodeMatchesRule(node: GraphNode, rule: FilterRule): boolean {
  switch (rule.field) {
    case "fqdn":
      return matches(node.fqdn, rule);

    case "hostname":
      return matches(node.hostname, rule);

    case "ip":
      return node.interfaces.some((netInterface) => matches(netInterface.ip, rule));

    case "mac":
      return node.interfaces.some((netInterface) => matches(netInterface.mac, rule));

    case "customer":
      return matches(node.customer.name, rule);

    case "distinct_edges":
      return matches(node.distinct_edge, rule);

    case "connections":
      return matches(node.connection_count, rule);

    case "first_seen":
      return matches(node.first_seen, rule);

    case "last_seen":
      return matches(node.last_seen, rule);

    default:
      return true;
  }
}

function edgeMatchesRule(edge: GraphEdge, rule: FilterRule): boolean {
  switch (rule.field) {
    case "fqdn":
      return matches(edge.source_fqdn, rule) || matches(edge.target_fqdn, rule);

    case "ip":
      return matches(edge.source_ip, rule) || matches(edge.target_ip, rule);

    case "first_seen":
      return matches(edge.first_seen, rule);

    case "last_seen":
      return matches(edge.last_seen, rule);

    case "process_name":
      return matches(edge.source_process_name, rule) || matches(edge.target_process_name, rule);

    case "protocol":
      return matches(edge.protocol, rule);

    case "service_port":
      return matches(edge.target_port, rule) || matches(edge.source_port, rule);

    case "service_name":
      return matches(edge.service_name, rule);

    case "seen_count":
      return matches(edge.seen_count, rule);

    case "edge_last_seen":
      return matches(edge.last_seen, rule);

    case "edge_first_seen":
      return matches(edge.first_seen, rule);

    default:
      return true;
  }
}

function isUsableRule(rule: FilterRule): boolean {
  if (rule.operator === "hasAnyValue") {
    return true;
  }

  if (rule.operator === "between") {
    return Array.isArray(rule.value) && rule.value.length === 2;
  }

  return rule.value !== null && rule.value !== undefined && String(rule.value).trim() !== "";
}

function matches(actualValue: string | number | null | undefined, rule: FilterRule): boolean {
  const filterValue = rule.value;
  const valueType = getFilterFieldDefinition(rule.field).valueType;

  switch (rule.operator) {
    case "is":
      if (valueType === "date") {
        return toDateInputValue(actualValue) === String(filterValue);
      }

      if (valueType === "number") {
        return Number(actualValue) === Number(filterValue);
      }

      return String(actualValue) === String(filterValue);

    case "isNot":
      if (valueType === "date") {
        return toDateInputValue(actualValue) !== String(filterValue);
      }

      if (valueType === "number") {
        return Number(actualValue) !== Number(filterValue);
      }

      return String(actualValue) !== String(filterValue);

    case "contains":
      return String(actualValue ?? "")
        .toLowerCase()
        .includes(String(filterValue ?? "").toLowerCase());

    case "greaterThan":
      return toComparableValue(actualValue, valueType) > toComparableValue(filterValue, valueType);

    case "lessThan":
      return toComparableValue(actualValue, valueType) < toComparableValue(filterValue, valueType);

    case "between": {
      if (!Array.isArray(filterValue)) {
        return true;
      }

      const [min, max] = filterValue;
      const comparableValue = toComparableValue(actualValue, valueType);

      return (
        comparableValue >= toComparableValue(min, valueType) &&
        comparableValue <= toComparableValue(max, valueType)
      );
    }

    case "hasAnyValue":
      return actualValue !== null && actualValue !== undefined && actualValue !== "";

    default:
      return true;
  }
}

function toComparableValue(value: unknown, valueType: string) {
  if (valueType === "date") {
    return Date.parse(String(value));
  }

  return Number(value);
}

function toDateInputValue(value: unknown) {
  const timestamp = Date.parse(String(value));

  if (Number.isNaN(timestamp)) {
    return "";
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

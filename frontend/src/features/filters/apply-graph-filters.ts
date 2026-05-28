import type { GraphEdge, GraphNode, GraphSnapshot } from "../graph/types";
import type { FilterRule, FiltersState } from "./types";

export function applyGraphFilters(
  graph: GraphSnapshot,
  filters: FiltersState,
): GraphSnapshot {
  const activeRules = filters.rules.filter(isUsableRule);

  if (activeRules.length === 0) {
    return graph;
  }

  let nodes = graph.nodes;
  let edges = graph.edges;
  const hasNodeRules = activeRules.some(isNodeFilter);
  const hasEdgeRules = activeRules.some(isEdgeFilter);

  for (const rule of activeRules) {
    if (isNodeFilter(rule)) {
      nodes = nodes.filter((node) => nodeMatchesRule(node, rule));
    }

    if (isEdgeFilter(rule)) {
      edges = edges.filter((edge) => edgeMatchesRule(edge, rule));
    }
  }

  const visibleNodeIds = new Set(nodes.map((node) => node.id));

  edges = edges.filter(
    (edge) =>
      visibleNodeIds.has(edge.source_fqdn) && visibleNodeIds.has(edge.target_fqdn),
  );

  if (hasEdgeRules && !hasNodeRules) {
    const connectedNodeIds = new Set<string>();

    for (const edge of edges) {
      connectedNodeIds.add(edge.source_fqdn);
      connectedNodeIds.add(edge.target_fqdn);
    }

    nodes = nodes.filter((node) => connectedNodeIds.has(node.fqdn));
  }

  return {
    nodes,
    edges,
    cursor: graph.cursor,
  };
}

function isNodeFilter(rule: FilterRule): boolean {
  return [
    "fqdn",
    "hostname",
    "ip",
    "mac",
    "customer",
    "distinct_edges",
    "connections",
    "first_seen",
    "last_seen",
  ].includes(rule.field);
}

function isEdgeFilter(rule: FilterRule): boolean {
  return [
    "source_ip",
    "target_ip",
    "protocol",
    "service_port",
    "service_name",
    "seen_count",
    "last_seen",
  ].includes(rule.field);
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
    case "source_ip":
      return matches(edge.source_ip, rule);

    case "target_ip":
      return matches(edge.target_ip, rule);

    case "protocol":
      return matches(edge.protocol, rule);

    case "service_port":
      return matches(edge.target_port, rule) || matches(edge.source_port, rule);

    case "service_name":
      return matches(edge.service_name, rule);

    case "seen_count":
      return matches(edge.seen_count, rule);

    case "last_seen":
      return matches(edge.last_seen, rule);

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

function matches(
  actualValue: string | number | null | undefined,
  rule: FilterRule,
): boolean {
  const filterValue = rule.value;

  switch (rule.operator) {
    case "is":
      return String(actualValue) === String(filterValue);

    case "isNot":
      return String(actualValue) !== String(filterValue);

    case "contains":
      return String(actualValue ?? "")
        .toLowerCase()
        .includes(String(filterValue ?? "").toLowerCase());

    case "greaterThan":
      return Number(actualValue) > Number(filterValue);

    case "lessThan":
      return Number(actualValue) < Number(filterValue);

    case "between": {
      if (!Array.isArray(filterValue)) {
        return true;
      }

      const [min, max] = filterValue;

      return Number(actualValue) >= Number(min) && Number(actualValue) <= Number(max);
    }

    case "hasAnyValue":
      return (
        actualValue !== null &&
        actualValue !== undefined &&
        actualValue !== ""
      );

    default:
      return true;
  }
}

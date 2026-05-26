import { fuzzy } from "fast-fuzzy";
import type { filter } from "../types/filter";
import type { GraphData, GraphEdge, NodeDetails, NodePortTarget } from "../types/graph";
import type Graph from "graphology";
import { getServiceName } from "../utils/portServices";

export type EdgeFilterContext = {
  sourceNode: NodeDetails;
  targetNode: NodeDetails;
  connections: GraphEdge[];
};

export function buildEffectiveFilters(filters: filter[], searchQuery: string): filter[] {
  if (!searchQuery.trim()) return filters;
  return [
    ...filters,
    {
      id: "__search__",
      type: "fqdn",
      operation: "include",
      value: searchQuery,
    },
  ];
}

export function matchesEdgeFilters(edge: EdgeFilterContext, filters: filter[]): boolean {
  return evaluateFilters(filters, (entry) => matchesEdgeCriterion(edge, entry));
}

export function edgeMatchesFilters(graph: Graph, edge: string, filters: filter[]) {
  const [source, target] = graph.extremities(edge);
  const sourceNode = graph.getNodeAttributes(source) as NodeDetails;
  const targetNode = graph.getNodeAttributes(target) as NodeDetails;
  const edgeData = graph.getEdgeAttributes(edge) as { connections?: unknown };
  const connections = Array.isArray(edgeData.connections) ? edgeData.connections as GraphData["edges"] : [];

  return matchesEdgeFilters({ sourceNode, targetNode, connections }, filters);
}

export function matchesNodeConnectionFilters(node: NodeDetails, target: NodePortTarget, filters: filter[]): boolean {
  return evaluateFilters(filters, (entry) => matchesNodeConnectionCriterion(node, target, entry));
}


function evaluateFilters(filters: filter[], matchesEntry: (entry: filter) => boolean): boolean {
  if (filters.length === 0) return true;

  const includesByType = new Map<filter["type"], filter[]>();
  let hasInclude = false;

  for (const entry of filters) {
    if (!entry.value.trim()) continue;

    const entryMatches = matchesEntry(entry);
    if (entry.id === "__search__" && !entryMatches) return false;
    if (entry.operation === "exclude" && entryMatches) return false;

    if (entry.operation === "include" && entry.id !== "__search__") {
      hasInclude = true;
      const entries = includesByType.get(entry.type);
      if (entries) entries.push(entry);
      else includesByType.set(entry.type, [entry]);
    }
  }

  if (!hasInclude) return true;

  for (const entries of includesByType.values()) {
    if (!entries.some(matchesEntry)) return false;
  }

  return true;
}

type CriterionContext = {
  fqdns: string[];
  ips: string[];
  ports: number[];
  servicePorts: number[];
  processNames: string[];
};

function matchesCriterion(context: CriterionContext, entry: filter): boolean {
  const value = entry.value.trim();
  if (!value) return true;

  if (entry.type === "port") {
    const port = Number(value);
    if (Number.isNaN(port)) return true;
    return context.ports.some((candidate) => candidate === port);
  }

  if (entry.type === "ip") {
    const lowerValue = value.toLowerCase();
    return context.ips.some((ip) => ip.toLowerCase() === lowerValue);
  }

  if (entry.type === "fqdn") {
    return context.fqdns.some((fqdn) => matchesFqdn(fqdn, value));
  }

  if (entry.type === "process") {
    const lowerValue = value.toLowerCase();
    return context.processNames.some((name) => name.toLowerCase().includes(lowerValue));
  }

  if (entry.type === "service") {
    const lowerValue = value.toLowerCase();
    return context.servicePorts.some((port) => getServiceName(port).toLowerCase() === lowerValue);
  }

  return true;
}

function matchesEdgeCriterion(edge: EdgeFilterContext, entry: filter): boolean {
  const ports: number[] = [];
  const processNames: string[] = [];

  for (const connection of edge.connections) {
    ports.push(connection.source_port, connection.target_port);
    if (connection.process_name) processNames.push(connection.process_name);
    if (connection.source_process_name) processNames.push(connection.source_process_name);
    if (connection.target_process_name) processNames.push(connection.target_process_name);
  }

  return matchesCriterion({
    fqdns: [edge.sourceNode.fqdn, edge.targetNode.fqdn],
    ips: [edge.sourceNode.ip, edge.targetNode.ip],
    ports,
    servicePorts: ports,
    processNames,
  }, entry);
}

function matchesNodeConnectionCriterion(node: NodeDetails, target: NodePortTarget, entry: filter): boolean {
  const processNames = target.processName ? [target.processName] : [];
  const ports = [target.port, target.remote_port];

  return matchesCriterion({
    fqdns: [node.fqdn, target.fqdn],
    ips: [node.ip, target.ip],
    ports,
    servicePorts: ports,
    processNames,
  }, entry);
}

function normalizeFqdn(s: string): string {
  return s.trim().toLowerCase().replace(/\.$/, "");
}

function matchesFqdn(fqdn: string, rawPattern: string): boolean {
  const host = normalizeFqdn(fqdn);
  const pattern = normalizeFqdn(rawPattern);
  const firstLabel = host.split(".")[0] ?? "";

  if (!pattern) return true;

  if (pattern.startsWith(".")) return host.endsWith(pattern);

  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return firstLabel.startsWith(prefix);
  }

  if (!pattern.includes(".")) return firstLabel.startsWith(pattern);


  return matchesFqdnFuzzy(host, firstLabel, pattern);
}

function matchesFqdnFuzzy(host: string, firstLabel: string, pattern: string): boolean {
  if (pattern.length < 1) return false;

  const fullScore = fuzzy(pattern, host);
  const labelScore = fuzzy(pattern, firstLabel);

  return Math.max(fullScore, labelScore) >= 0.95;
}
